//! O acutis como aplicativo de desktop.
//!
//! O app não é o produto: o produto são os três serviços que ele sobe. Este arquivo prepara o
//! estado gravável, escolhe portas, sobe os três, aponta a janela para o frontend e derruba tudo na
//! saída.

mod services;
mod state;

use std::fs::File;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

use services::{log_tail, plan, wait_until_up, Ports, Resources, Service};
use state::{free_port, Layout};
use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

/// Tempo que damos a cada serviço para responder. O backend é o mais lento no primeiro boot, porque
/// roda as migrações antes de servir.
const BOOT_TIMEOUT: Duration = Duration::from_secs(90);

/// Os filhos vivos, para poder matá-los na saída. Órfão aqui significa porta ocupada e um php
/// rodando escondido depois que o usuário fechou a janela.
struct Running(Mutex<Vec<Child>>);

fn spawn(service: &Service, layout: &Layout) -> std::io::Result<Child> {
    let log = File::create(layout.logs.join(format!("{}.log", service.name)))?;

    let mut command = Command::new(&service.program);

    command
        .args(&service.args)
        .current_dir(&service.cwd)
        .envs(&service.env)
        .stdout(Stdio::from(log.try_clone()?))
        .stderr(Stdio::from(log));

    // Cada serviço no próprio grupo de processos: é o que permite derrubar de uma vez o filho e
    // tudo que ele abriu — o node do Playwright, por exemplo, abre navegador.
    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        command.process_group(0);
    }

    command.spawn()
}

/// Derruba o que sobrou de uma execução anterior que não passou pelo encerramento normal — crash,
/// force quit, `kill -9`.
///
/// Sem isto o usuário acumula um php e dois node a cada vez que o app morre torto, cada um segurando
/// porta e memória até ele reiniciar a máquina.
///
/// Só mata o que reconhece como nosso: o PID pode ter sido reciclado pelo sistema e pertencer agora
/// a um processo de outra pessoa.
fn kill_leftovers(layout: &Layout) {
    let Ok(recorded) = std::fs::read_to_string(&layout.pids) else {
        return;
    };

    for pid in recorded.lines().filter_map(|line| line.trim().parse::<u32>().ok()) {
        if is_ours(pid, &layout.app) {
            services::kill_tree(pid);
        }
    }

    let _ = std::fs::remove_file(&layout.pids);
}

/// Se o processo com este PID é um dos nossos, e não um estranho que herdou o número.
fn is_ours(pid: u32, app: &std::path::Path) -> bool {
    #[cfg(unix)]
    {
        let Ok(output) = Command::new("ps").args(["-o", "command=", "-p", &pid.to_string()]).output()
        else {
            return false;
        };

        String::from_utf8_lossy(&output.stdout).contains(&*app.to_string_lossy())
    }

    #[cfg(windows)]
    {
        let Ok(output) = Command::new("wmic")
            .args(["process", "where", &format!("ProcessId={pid}"), "get", "ExecutablePath"])
            .output()
        else {
            return false;
        };

        String::from_utf8_lossy(&output.stdout).contains(&*app.to_string_lossy())
    }
}

/// Prepara o banco antes de qualquer serviço subir.
///
/// Roda em todo boot, não só no primeiro: é assim que a versão nova do app aplica as migrações que
/// vieram com ela. `migrate --force` não faz nada quando não há o que aplicar.
fn migrate(res: &Resources, service: &Service) -> Result<(), String> {
    // O cwd do serviço é `backend/public`, que é o que o servidor embutido exige; o artisan mora um
    // nível acima.
    let output = Command::new(res.bin("php"))
        .args(["artisan", "migrate", "--force"])
        .current_dir(res.dir("backend"))
        .envs(&service.env)
        .output()
        .map_err(|e| format!("não consegui rodar as migrações: {e}"))?;

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "as migrações falharam:\n{}",
        String::from_utf8_lossy(&output.stderr)
    ))
}

fn boot(app: &tauri::App) -> Result<(), String> {
    let home = app
        .path()
        .home_dir()
        .map_err(|e| format!("não achei o diretório do usuário: {e}"))?;

    let payload = app
        .path()
        .resource_dir()
        .map_err(|e| format!("não achei os recursos do app: {e}"))?
        .join("acutis-payload.tar.gz");

    let layout = Layout::resolve(&home);

    layout
        .ensure()
        .map_err(|e| format!("não consegui preparar {}: {e}", layout.root.display()))?;

    kill_leftovers(&layout);

    let res = Resources::install(&payload, layout.app.clone())
        .map_err(|e| format!("não consegui instalar os arquivos do app em {}: {e}", layout.app.display()))?;

    let app_key = layout
        .app_key()
        .map_err(|e| format!("não consegui gerar a chave da aplicação: {e}"))?;

    let ports = Ports {
        backend: free_port().map_err(|e| e.to_string())?,
        frontend: free_port().map_err(|e| e.to_string())?,
        webdriver: free_port().map_err(|e| e.to_string())?,
    };

    let frontend_url = format!("http://127.0.0.1:{}", ports.frontend);
    let plan = plan(&res, &layout, &ports, &app_key);

    migrate(&res, &plan[0])?;

    let mut children = Vec::new();

    for service in &plan {
        let child = spawn(service, &layout)
            .map_err(|e| format!("não consegui subir o {}: {e}", service.name))?;

        children.push(child);

        // Registrado antes do health check: se o serviço travar e o usuário matar o app na força, o
        // PID precisa estar gravado para o próximo boot poder limpá-lo.
        let _ = std::fs::write(
            &layout.pids,
            children.iter().map(|c: &Child| c.id().to_string()).collect::<Vec<_>>().join("\n"),
        );

        if !wait_until_up(&service.health, BOOT_TIMEOUT) {
            return Err(format!(
                "o {} não respondeu em {}s. Últimas linhas do log:\n\n{}",
                service.name,
                BOOT_TIMEOUT.as_secs(),
                log_tail(&layout.logs, service.name, 20)
            ));
        }
    }

    app.manage(Running(Mutex::new(children)));

    WebviewWindowBuilder::new(
        app,
        "acutis",
        WebviewUrl::External(frontend_url.parse().map_err(|e| format!("{e}"))?),
    )
    .title("acutis")
    .inner_size(1440.0, 900.0)
    .build()
    .map_err(|e| format!("não consegui abrir a janela: {e}"))?;

    Ok(())
}

/// A janela que substitui a do app quando o boot falha.
///
/// Sem isto o usuário vê o app abrir e fechar sem explicação — e o log fica num diretório que ele
/// não sabe que existe.
fn show_failure(app: &tauri::App, message: &str) {
    let logs = app
        .path()
        .home_dir()
        .map(|home| Layout::resolve(&home).logs.display().to_string())
        .unwrap_or_default();

    let html = format!(
        r#"<!doctype html><meta charset="utf-8">
        <style>
          body {{ font: 14px ui-sans-serif, system-ui; padding: 2rem; line-height: 1.6;
                  background: #18181b; color: #e4e4e7; }}
          h1 {{ font-size: 1.1rem; margin: 0 0 1rem; }}
          pre {{ background: #27272a; padding: 1rem; border-radius: .5rem; overflow-x: auto;
                 white-space: pre-wrap; }}
          p {{ color: #a1a1aa; }}
        </style>
        <h1>O acutis não conseguiu iniciar</h1>
        <pre>{}</pre>
        <p>Os logs completos estão em {}</p>"#,
        html_escape(message),
        html_escape(&logs)
    );

    let _ = WebviewWindowBuilder::new(app, "erro", WebviewUrl::External(
        format!("data:text/html;charset=utf-8,{}", urlencoding::encode(&html))
            .parse()
            .expect("data: url é sempre válida"),
    ))
    .title("acutis — erro ao iniciar")
    .inner_size(760.0, 520.0)
    .build();
}

fn html_escape(text: &str) -> String {
    text.replace('&', "&amp;").replace('<', "&lt;").replace('>', "&gt;")
}

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if let Err(message) = boot(app) {
                show_failure(app, &message);
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("erro ao construir o app")
        .run(|app, event| {
            // Fechar a janela não mata os filhos: sem isto ficam um php e dois node rodando, com as
            // portas presas, até o usuário reiniciar a máquina.
            if let RunEvent::Exit = event {
                if let Some(running) = app.try_state::<Running>() {
                    for child in running.0.lock().unwrap().iter_mut() {
                        services::kill_tree(child.id());
                        let _ = child.wait();
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::html_escape;

    #[test]
    fn escapes_the_error_before_putting_it_in_the_page() {
        assert_eq!(
            html_escape("erro em <script>alert(1)</script> & cia"),
            "erro em &lt;script&gt;alert(1)&lt;/script&gt; &amp; cia"
        );
    }
}
