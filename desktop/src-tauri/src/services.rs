//! Os três serviços do acutis rodando como processos filhos do app.
//!
//! Nada aqui fala com o usuário: monta comando, sobe, espera responder. Quem traduz falha em janela
//! de erro é o `lib.rs`.

use std::collections::HashMap;
use std::io;
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};

use crate::state::Layout;

/// Onde estão os recursos que viajaram no bundle — já extraídos, fora dele.
pub struct Resources {
    pub root: PathBuf,
}

impl Resources {
    pub fn new(root: PathBuf) -> Self {
        Self { root }
    }

    /// Extrai o payload, se ainda não estiver extraído para esta versão.
    ///
    /// O bundle carrega um .tar.gz em vez dos arquivos soltos porque o empacotador do Tauri copia
    /// conteúdo sem recriar symlink: o node_modules perderia os pacotes e o Chrome for Testing
    /// perderia os links internos do .framework, sem os quais não abre. Extrair aqui devolve links
    /// e permissões intactos.
    ///
    /// Cada versão extrai para o próprio diretório, então atualizar o app não mistura arquivo novo
    /// com arquivo velho.
    ///
    /// ponytail: extração síncrona antes da janela aparecer — no primeiro boot são alguns minutos
    /// de silêncio. Se incomodar, o caminho é uma janela de progresso lendo o andamento do unpack.
    pub fn install(payload: &Path, into: PathBuf) -> io::Result<Self> {
        let done = into.join(".installed");

        if done.is_file() {
            return Ok(Self::new(into));
        }

        // Extração interrompida deixa lixo pela metade; começar do zero é mais barato que descobrir
        // o que faltou.
        if into.exists() {
            std::fs::remove_dir_all(&into)?;
        }

        std::fs::create_dir_all(&into)?;

        let file = std::fs::File::open(payload)?;
        let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(file));

        archive.set_preserve_permissions(true);
        archive.set_unpack_xattrs(true);
        archive.unpack(&into)?;

        std::fs::write(&done, env!("CARGO_PKG_VERSION"))?;

        Ok(Self::new(into))
    }

    /// Executável com a extensão que o sistema exige. No Windows, `php` sem `.exe` não roda.
    pub fn bin(&self, name: &str) -> PathBuf {
        self.root.join(format!("{name}{}", std::env::consts::EXE_SUFFIX))
    }

    pub fn dir(&self, name: &str) -> PathBuf {
        self.root.join(name)
    }

    /// O CLI do Playwright é um .js: quem o executa é o node que veio junto, porque no bundle não
    /// existe outro.
    pub fn playwright_cli(&self) -> PathBuf {
        self.dir("webdriver").join("node_modules/playwright/cli.js")
    }

    /// O git só viaja no bundle onde o sistema costuma não ter. Nos demais, vale o do PATH — e é o
    /// que permite ao clone usar as chaves e o credential helper que o usuário já configurou.
    pub fn git_bin(&self) -> String {
        let bundled = self.dir("git").join("cmd/git.exe");

        if bundled.is_file() {
            bundled.to_string_lossy().into_owned()
        } else {
            "git".to_string()
        }
    }
}

pub struct Ports {
    pub backend: u16,
    pub frontend: u16,
    pub webdriver: u16,
}

/// Um serviço pronto para subir: o que executar, de onde, e com que ambiente.
pub struct Service {
    pub name: &'static str,
    pub program: PathBuf,
    pub args: Vec<String>,
    pub cwd: PathBuf,
    pub env: HashMap<String, String>,
    pub health: String,
}

fn args(list: &[&str]) -> Vec<String> {
    list.iter().map(|a| a.to_string()).collect()
}

/// Os três serviços, já com as URLs cruzadas.
///
/// Tudo escuta em 127.0.0.1: isto é um app de desktop, não um servidor — abrir na rede exporia os
/// projetos do usuário para a máquina inteira.
pub fn plan(res: &Resources, layout: &Layout, ports: &Ports, app_key: &str) -> Vec<Service> {
    let backend_url = format!("http://127.0.0.1:{}", ports.backend);
    let frontend_url = format!("http://127.0.0.1:{}", ports.frontend);
    let webdriver_url = format!("http://127.0.0.1:{}", ports.webdriver);

    let mut backend_env = HashMap::from([
        ("APP_KEY".into(), app_key.to_string()),
        ("APP_ENV".into(), "production".to_string()),
        ("APP_DEBUG".into(), "false".to_string()),
        // Lida do ambiente do processo, antes do .env — é por isso que ela vem daqui e não de um
        // arquivo. Sem ela o Laravel tentaria escrever dentro do bundle, que é somente-leitura.
        ("LARAVEL_STORAGE_PATH".into(), layout.storage.to_string_lossy().into_owned()),
        ("DB_CONNECTION".into(), "sqlite".to_string()),
        ("DB_DATABASE".into(), layout.database.to_string_lossy().into_owned()),
        ("ACUTIS_PROJECTS_PATH".into(), layout.projects.to_string_lossy().into_owned()),
        ("WEBDRIVER_URL".into(), webdriver_url.clone()),
        ("ACUTIS_GIT_BIN".into(), res.git_bin()),
    ]);

    // Sem isto o Laravel guardaria sessão e cache em arquivo dentro do bundle.
    backend_env.insert("SESSION_DRIVER".into(), "database".to_string());
    backend_env.insert("CACHE_STORE".into(), "database".to_string());

    let webdriver_env = HashMap::from([
        ("PORT".into(), ports.webdriver.to_string()),
        ("CORS_ORIGIN".into(), frontend_url.clone()),
        // Sem isto os endpoints /runner/* respondem 403 e o botão "Testar" não funciona.
        ("WEBDRIVER_TEST_MODE".into(), "1".to_string()),
        ("PLAYWRIGHT_BROWSERS_PATH".into(), res.dir("browsers").to_string_lossy().into_owned()),
        ("ACUTIS_PLAYWRIGHT_CLI".into(), res.playwright_cli().to_string_lossy().into_owned()),
        // Vazia de propósito: é o que faz o gravador abrir o próprio Chromium em vez de procurar um
        // Chrome com porta de debug, que é o atrito que só existe dentro do container.
        ("RECORDER_CDP_URL".into(), String::new()),
    ]);

    let frontend_env = HashMap::from([
        ("NITRO_PORT".into(), ports.frontend.to_string()),
        ("NITRO_HOST".into(), "127.0.0.1".to_string()),
        ("NUXT_API_ACUTIS_URL".into(), backend_url.clone()),
        ("NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL".into(), webdriver_url.clone()),
    ]);

    vec![
        Service {
            name: "backend",
            program: res.bin("php"),
            // O servidor embutido é chamado direto, e não por `artisan serve`, porque o artisan é
            // só um pai que dá spawn neste mesmo comando: sobrando um processo a mais para a saída
            // do app ter que alcançar. O `server.php` é o mesmo roteador que o artisan usaria, e
            // ele lê o diretório público do cwd — daí o cwd ser `backend/public`.
            args: vec![
                "-S".into(),
                format!("127.0.0.1:{}", ports.backend),
                "../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php".into(),
            ],
            cwd: res.dir("backend").join("public"),
            env: backend_env,
            health: format!("{backend_url}/up"),
        },
        Service {
            name: "webdriver",
            program: res.bin("node"),
            args: args(&["dist/main.js"]),
            cwd: res.dir("webdriver"),
            env: webdriver_env,
            health: format!("{webdriver_url}/health"),
        },
        Service {
            name: "frontend",
            program: res.bin("node"),
            args: args(&[".output/server/index.mjs"]),
            cwd: res.dir("frontend"),
            env: frontend_env,
            health: frontend_url,
        },
    ]
}

/// Mata o processo e tudo que ele tenha aberto.
///
/// Matar só o PID não basta: o node do Playwright abre navegador, e o que sobra fica com porta
/// presa e memória ocupada depois que o usuário fechou a janela.
pub fn kill_tree(pid: u32) {
    #[cfg(unix)]
    // O filho foi posto no próprio grupo (ver `spawn`), então o alvo negativo alcança ele e todos
    // os netos de uma vez.
    let _ = std::process::Command::new("kill")
        .args(["-TERM", &format!("-{pid}")])
        .status();

    #[cfg(windows)]
    let _ = std::process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .status();
}

/// Espera um endereço responder qualquer coisa que não seja "conexão recusada".
///
/// Não olha o código HTTP: um 404 já prova que há alguém escutando, e é tudo que interessa aqui.
pub fn wait_until_up(url: &str, timeout: Duration) -> bool {
    let deadline = Instant::now() + timeout;

    while Instant::now() < deadline {
        if ureq::get(url).timeout(Duration::from_secs(2)).call().is_ok() {
            return true;
        }

        std::thread::sleep(Duration::from_millis(250));
    }

    false
}

/// As últimas linhas do log de um serviço, para a janela de erro dizer o que houve em vez de só
/// dizer que houve.
pub fn log_tail(logs: &Path, name: &str, lines: usize) -> String {
    let content = std::fs::read_to_string(logs.join(format!("{name}.log"))).unwrap_or_default();
    let all: Vec<&str> = content.lines().collect();
    let start = all.len().saturating_sub(lines);

    all[start..].join("\n")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> (Resources, Layout, Ports) {
        (
            Resources::new(PathBuf::from("/opt/acutis")),
            Layout::resolve(Path::new("/home/kauan")),
            Ports { backend: 1111, frontend: 2222, webdriver: 3333 },
        )
    }

    /// O motivo de existir o payload: o empacotador do Tauri achata symlink, e sem eles o
    /// node_modules perde pacotes e o Chrome for Testing nem abre. Extrair tem que devolvê-los.
    #[test]
    fn extracts_the_payload_with_symlinks_and_permissions_intact() {
        let temp = std::env::temp_dir().join(format!("acutis-payload-{}", std::process::id()));
        let origem = temp.join("origem");
        std::fs::create_dir_all(origem.join("webdriver")).unwrap();
        std::fs::write(origem.join("php"), b"#!/bin/sh\n").unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(origem.join("php"), std::fs::Permissions::from_mode(0o755))
                .unwrap();
            std::os::unix::fs::symlink("../php", origem.join("webdriver/php-link")).unwrap();
        }

        let payload = temp.join("payload.tar.gz");
        let status = std::process::Command::new("tar")
            .args(["czf", payload.to_str().unwrap(), "-C", origem.to_str().unwrap(), "."])
            .status()
            .unwrap();
        assert!(status.success());

        let destino = temp.join("destino");
        let res = Resources::install(&payload, destino.clone()).expect("deveria extrair");

        assert!(res.bin("php").is_file());
        assert!(destino.join(".installed").is_file());

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let link = destino.join("webdriver/php-link");
            assert!(link.symlink_metadata().unwrap().file_type().is_symlink());
            let mode = std::fs::metadata(res.bin("php")).unwrap().permissions().mode();
            assert_eq!(mode & 0o111, 0o111, "o php precisa continuar executável");
        }

        std::fs::remove_dir_all(&temp).ok();
    }

    #[test]
    fn points_each_service_at_the_others() {
        let (res, layout, ports) = fixture();
        let plan = plan(&res, &layout, &ports, "base64:x");

        let frontend = plan.iter().find(|s| s.name == "frontend").unwrap();
        assert_eq!(frontend.env["NUXT_API_ACUTIS_URL"], "http://127.0.0.1:1111");
        assert_eq!(frontend.env["NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL"], "http://127.0.0.1:3333");

        let backend = plan.iter().find(|s| s.name == "backend").unwrap();
        assert_eq!(backend.env["WEBDRIVER_URL"], "http://127.0.0.1:3333");

        let webdriver = plan.iter().find(|s| s.name == "webdriver").unwrap();
        assert_eq!(webdriver.env["CORS_ORIGIN"], "http://127.0.0.1:2222");
    }

    /// O bundle é somente-leitura: se qualquer um destes apontasse para dentro dele, o backend
    /// quebraria na primeira escrita — que acontece logo no primeiro request.
    #[test]
    fn keeps_every_writable_path_outside_the_bundle() {
        let (res, layout, ports) = fixture();
        let plan = plan(&res, &layout, &ports, "base64:x");
        let backend = plan.iter().find(|s| s.name == "backend").unwrap();

        for key in ["LARAVEL_STORAGE_PATH", "DB_DATABASE", "ACUTIS_PROJECTS_PATH"] {
            assert!(
                backend.env[key].starts_with("/home/kauan/.acutis"),
                "{key} deveria morar em ~/.acutis, mas aponta para {}",
                backend.env[key]
            );
        }
    }

    #[test]
    fn runs_the_playwright_cli_that_came_in_the_bundle() {
        let (res, layout, ports) = fixture();
        let plan = plan(&res, &layout, &ports, "base64:x");
        let webdriver = plan.iter().find(|s| s.name == "webdriver").unwrap();

        assert_eq!(
            webdriver.env["ACUTIS_PLAYWRIGHT_CLI"],
            "/opt/acutis/webdriver/node_modules/playwright/cli.js"
        );
    }

    /// Sem git no bundle vale o do PATH, que é o único que enxerga as chaves e o credential helper
    /// do usuário.
    #[test]
    fn falls_back_to_the_system_git_when_the_bundle_has_none() {
        let res = Resources::new(PathBuf::from("/opt/acutis"));

        assert_eq!(res.git_bin(), "git");
    }

    #[test]
    fn asks_the_recorder_to_open_its_own_browser() {
        let (res, layout, ports) = fixture();
        let plan = plan(&res, &layout, &ports, "base64:x");
        let webdriver = plan.iter().find(|s| s.name == "webdriver").unwrap();

        assert_eq!(webdriver.env["RECORDER_CDP_URL"], "");
    }
}
