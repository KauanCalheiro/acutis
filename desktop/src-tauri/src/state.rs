//! Onde o app grava e em que portas ele sobe.
//!
//! O bundle é somente-leitura — `.app` assinado no macOS, Program Files no Windows —, então todo
//! estado que muda mora em `~/.acutis/runtime`. É o mesmo `~/.acutis` onde os projetos do usuário
//! já vivem, num subdiretório para não se misturar com eles.

use base64::engine::general_purpose::STANDARD as BASE64;
use base64::Engine;
use std::io;
use std::net::TcpListener;
use std::path::PathBuf;

pub struct Layout {
    pub root: PathBuf,
    pub storage: PathBuf,
    pub database: PathBuf,
    pub app_key: PathBuf,
    pub logs: PathBuf,
    pub projects: PathBuf,
    /// Onde o payload do bundle é extraído. Por versão, para uma atualização não misturar arquivo
    /// novo com arquivo velho.
    pub app: PathBuf,
    /// Os PIDs da execução atual, para a próxima limpar o que tiver sobrado de uma morte abrupta.
    pub pids: PathBuf,
}

impl Layout {
    pub fn resolve(home: &std::path::Path) -> Self {
        let projects = home.join(".acutis");
        let root = projects.join("runtime");

        Self {
            storage: root.join("storage"),
            database: root.join("database.sqlite"),
            app_key: root.join("app-key"),
            logs: root.join("logs"),
            app: root.join("app").join(env!("CARGO_PKG_VERSION")),
            pids: root.join("pids"),
            root,
            projects,
        }
    }

    /// A chave que o Laravel usa para assinar sessão e cookie.
    ///
    /// Nasce aqui em vez de `php artisan key:generate` porque o `.env` moraria dentro do bundle,
    /// que é somente-leitura — o backend recebe a chave pelo ambiente do processo. Uma vez gerada,
    /// é reusada: trocá-la a cada boot invalidaria tudo que ficou assinado com a anterior.
    pub fn app_key(&self) -> io::Result<String> {
        if let Ok(existing) = std::fs::read_to_string(&self.app_key) {
            let existing = existing.trim().to_string();

            if !existing.is_empty() {
                return Ok(existing);
            }
        }

        let mut bytes = [0u8; 32];
        getrandom::getrandom(&mut bytes)
            .map_err(|e| io::Error::new(io::ErrorKind::Other, e.to_string()))?;

        let key = format!("base64:{}", BASE64.encode(bytes));
        std::fs::write(&self.app_key, &key)?;

        Ok(key)
    }

    /// Cria o que falta. Roda em todo boot, não só no primeiro: o usuário pode apagar qualquer
    /// coisa daqui entre uma execução e outra, e o Laravel não recria sozinho.
    pub fn ensure(&self) -> io::Result<()> {
        for dir in [
            &self.projects,
            &self.root,
            &self.logs,
            &self.storage.join("framework/cache/data"),
            &self.storage.join("framework/sessions"),
            &self.storage.join("framework/views"),
            &self.storage.join("logs"),
            &self.storage.join("app/private"),
        ] {
            std::fs::create_dir_all(dir)?;
        }

        if !self.database.exists() {
            std::fs::write(&self.database, b"")?;
        }

        Ok(())
    }
}

/// Uma porta que o sistema diz estar livre agora.
///
/// Entre soltar o listener e o serviço subir existe uma janela em que outro processo pode tomar a
/// porta. É improvável o bastante para não valer um protocolo de reserva: o serviço falha ao subir,
/// e o app mostra o erro.
pub fn free_port() -> io::Result<u16> {
    let listener = TcpListener::bind("127.0.0.1:0")?;
    let port = listener.local_addr()?.port();

    drop(listener);

    Ok(port)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn puts_every_writable_thing_under_acutis_runtime() {
        let layout = Layout::resolve(std::path::Path::new("/home/kauan"));

        assert_eq!(layout.root, PathBuf::from("/home/kauan/.acutis/runtime"));
        assert_eq!(layout.database, PathBuf::from("/home/kauan/.acutis/runtime/database.sqlite"));
        assert_eq!(layout.storage, PathBuf::from("/home/kauan/.acutis/runtime/storage"));
        assert_eq!(layout.projects, PathBuf::from("/home/kauan/.acutis"));
    }

    #[test]
    fn creates_the_whole_tree_including_the_database_file() {
        let temp = std::env::temp_dir().join(format!("acutis-layout-{}", std::process::id()));
        let layout = Layout::resolve(&temp);

        layout.ensure().expect("deveria criar a árvore");

        assert!(layout.storage.join("framework/views").is_dir());
        assert!(layout.logs.is_dir());
        assert!(layout.database.is_file());

        std::fs::remove_dir_all(&temp).ok();
    }

    /// Chave nova a cada boot invalidaria toda sessão e todo cookie assinado com a anterior.
    #[test]
    fn generates_the_app_key_once_and_reuses_it() {
        let temp = std::env::temp_dir().join(format!("acutis-key-{}", std::process::id()));
        let layout = Layout::resolve(&temp);
        layout.ensure().expect("deveria criar a árvore");

        let first = layout.app_key().expect("deveria gerar");
        let second = layout.app_key().expect("deveria reusar");

        assert!(first.starts_with("base64:"));
        assert_eq!(first, second);
        // 32 bytes em base64 dão 44 caracteres, que é o que o Laravel espera do cipher padrão.
        assert_eq!(first.trim_start_matches("base64:").len(), 44);

        std::fs::remove_dir_all(&temp).ok();
    }

    #[test]
    fn hands_out_a_port_nobody_is_listening_on() {
        let port = free_port().expect("deveria achar porta livre");

        assert!(port > 0);
        // Livre de verdade: se alguém estivesse escutando, este bind falharia.
        TcpListener::bind(("127.0.0.1", port)).expect("a porta deveria estar livre");
    }
}
