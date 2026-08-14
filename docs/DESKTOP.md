# O acutis como aplicativo de desktop

Para quem **constrói** o instalador. Quem só quer usar o acutis: [INSTALL.md](INSTALL.md).

O desenho e o porquê de cada escolha estão em
[docs/superpowers/specs/2026-08-14-empacotamento-desktop-design.md](superpowers/specs/2026-08-14-empacotamento-desktop-design.md).
Publicar uma versão: [RELEASE.md](RELEASE.md).

## Como funciona

O app é um shell [Tauri](https://tauri.app) que não implementa nada do produto: sobe os três
serviços de sempre como processos filhos e aponta a janela para o frontend.

```
acutis (Tauri)
├── php -S 127.0.0.1:<porta>       backend Laravel
├── node dist/main.js              webdriver NestJS
└── node .output/server/index.mjs  frontend Nuxt  ← a janela abre aqui
```

As portas são pedidas ao sistema em cada boot e as URLs entram no ambiente de cada processo, então
nada precisa ser reconstruído para trocar de porta.

**Estado gravável** mora em `~/.acutis/runtime`, nunca dentro do bundle (que é somente-leitura):
banco SQLite, `storage/` do Laravel, `APP_KEY`, logs e os arquivos do app extraídos por versão. Os
projetos do usuário continuam em `~/.acutis`, como antes.

**O payload.** O bundle carrega um `.tar.gz` e o extrai no primeiro boot, em vez de levar os
arquivos soltos. O empacotador do Tauri copia conteúdo mas não recria symlink, e sem eles o
`node_modules` perde pacotes e o Chrome for Testing perde os links internos do `.framework` — sem os
quais o navegador não abre.

## O que viaja no bundle

| Item | De onde vem | Por quê |
|---|---|---|
| `php` | [static-php-cli](https://dl.static-php.dev), variante `common` | a `bulk`, apesar do nome, **não** traz `pdo_sqlite`, e sem ele o backend não abre o banco |
| `node` | nodejs.org | roda o webdriver, o frontend e o CLI do Playwright |
| `ffmpeg` | pacote `ffmpeg-static` do webdriver | corta o intro preto do vídeo da execução; vem no `node_modules`, sem download à parte |
| `chromium` | `playwright install chromium` | gravação e execução dos testes |
| `git` | MinGit, **só no Windows** | macOS e Linux quase sempre têm; o app detecta e desabilita a importação de repositório quando falta |

O `git` é a única dependência que continua vindo do sistema, e de propósito: clone privado e `push`
dependem das chaves em `~/.ssh` e do credential helper nativo, que são do usuário. O app passa o
`HOME` dele adiante em vez de isolar.

---

# Construir

Três passos iguais em qualquer sistema — o que muda são os pré-requisitos, na seção seguinte.

```sh
./desktop/scripts/bundle-resources.sh   # baixa runtimes, constrói os três serviços, gera o payload
./desktop/scripts/bundle-smoke.sh       # prova que o bundle funciona, sem abrir janela
cd desktop && pnpm dlx @tauri-apps/cli@latest build --bundles <alvos>
```

O primeiro comando leva vários minutos e baixa ~400 MB. É idempotente: apague `desktop/resources`
para forçar tudo do zero. Os testes do shell:

```sh
cd desktop/src-tauri && cargo test
```

**Só se constrói para o sistema em que se está.** Não há compilação cruzada aqui: o `.msi` sai de uma
máquina Windows, o `.AppImage` de uma Linux. Quem faz os três é o
[workflow de release](RELEASE.md).

## Pré-requisitos comuns

Em qualquer sistema, antes de tudo:

| Ferramenta | Para quê | Instalar |
|---|---|---|
| Rust | compila o shell Tauri | [rustup.rs](https://rustup.rs) |
| Node 22 + pnpm 11 | constrói frontend e webdriver | [nodejs.org](https://nodejs.org), depois `corepack enable pnpm` |
| PHP 8.4 + Composer | resolve o `vendor/` do backend | ver cada sistema abaixo |
| Git | clona o repositório e alimenta o MinGit no Windows | ver cada sistema abaixo |

O PHP da sua máquina só resolve dependências; quem roda no app é o PHP que vai no bundle.

---

## macOS (Apple Silicon)

```sh
xcode-select --install                       # compilador e o git do sistema
brew install php composer node pnpm
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Construir:

```sh
./desktop/scripts/bundle-resources.sh
./desktop/scripts/bundle-smoke.sh
cd desktop && pnpm dlx @tauri-apps/cli@latest build --bundles app,dmg
```

Saída em `desktop/src-tauri/target/release/bundle/`:

- `macos/acutis.app` — o aplicativo
- `dmg/acutis_<versão>_aarch64.dmg` — o que se distribui

O `.dmg` só é gerado se houver espaço em disco de sobra: o `bundle_dmg.sh` monta uma imagem
temporária do tamanho do app. Um `.dmg` que falha sem explicação costuma ser isso.

> Máquinas Intel produzem um `.dmg` `x86_64`, que **não** roda em Apple Silicon e vice-versa. A
> release publica apenas `aarch64`.

---

## Ubuntu 22.04+

O Tauri usa a webview do sistema, e ela precisa dos pacotes de desenvolvimento:

```sh
sudo apt update
sudo apt install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf \
                    build-essential curl wget file libssl-dev git

# node e pnpm
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
sudo corepack enable pnpm

# php e composer
sudo apt install -y php8.4-cli php8.4-mbstring php8.4-xml php8.4-curl composer

# rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

> Se o `php8.4` não existir no seu Ubuntu, adicione o PPA do Ondřej:
> `sudo add-apt-repository ppa:ondrej/php && sudo apt update`.

Construir:

```sh
./desktop/scripts/bundle-resources.sh
./desktop/scripts/bundle-smoke.sh
cd desktop && pnpm dlx @tauri-apps/cli@latest build --bundles appimage,deb
```

Saída em `desktop/src-tauri/target/release/bundle/`:

- `appimage/acutis_<versão>_amd64.AppImage` — roda em qualquer distribuição
- `deb/acutis_<versão>_amd64.deb` — integra ao menu, e declara a dependência da webview

O `.AppImage` **não** embute a WebKitGTK: quem instalar por ele precisa ter `libwebkit2gtk-4.1-0`.
Construa na versão mais antiga do Ubuntu que você pretende suportar — o binário exige a glibc da
máquina de build ou mais nova, então construir no 24.04 quebra no 22.04, mas o contrário funciona.

---

## Windows 10/11 (x64)

Os scripts de build são shell script: rode-os no **Git Bash**, que vem com o Git for Windows. O
PowerShell não os executa.

```powershell
winget install Microsoft.VisualStudio.2022.BuildTools   # marque "Desenvolvimento com C++"
winget install Rustlang.Rustup
winget install OpenJS.NodeJS.LTS
winget install Git.Git
winget install PHP.PHP.8.4
winget install Composer.Composer
```

Depois, em qualquer terminal: `corepack enable pnpm`.

Construir (**no Git Bash**, a partir da raiz do repositório):

```bash
./desktop/scripts/bundle-resources.sh
cd desktop && pnpm dlx @tauri-apps/cli@latest build --bundles msi
```

Saída em `desktop/src-tauri/target/release/bundle/msi/acutis_<versão>_x64_en-US.msi`.

Três diferenças em relação aos outros sistemas:

- **O `bundle-smoke.sh` não roda aqui.** Ele sobe os serviços com sintaxe de shell POSIX. No Windows
  a verificação é abrir o `.msi` instalado e conferir que a janela sobe.
- **O MinGit entra no bundle**, baixado da última release do git-for-windows. É o único sistema em
  que o `git` viaja junto.
- **O WebView2** é a webview usada; já vem no Windows 11 e no 10 atualizado.

> **Não verificado.** O build do Windows foi escrito mas nunca executado — nem localmente, nem no
> CI. O ponto de maior risco é o `php.exe` do static-php-cli (variante `spc-max`): o binário é
> comprimido com UPX, então não dá para inspecionar as extensões dele de fora, e ninguém confirmou
> ainda que ele traz `pdo_sqlite`, `mbstring` e `openssl`. O `bundle-resources.sh` checa
> `pdo_sqlite` e aborta com mensagem clara se faltar — é o primeiro erro a esperar. O plano B é o
> PHP oficial de [windows.php.net](https://windows.php.net/download/) (não estático, mas
> redistribuível), habilitando as extensões pelo `php.ini`.

---

## Versões fixas

`PHP_VERSION` e `NODE_VERSION` estão fixos em `desktop/scripts/bundle-resources.sh`. O PHP precisa
ser **igual ou maior** que o que resolveu o `vendor/`: o `platform_check.php` do Composer recusa
rodar em versão menor, e o erro aparece só na máquina do usuário.

## Limitação conhecida

Fechar a janela derruba os três serviços. Um `kill -9` no app, não: os filhos ficam vivos até o boot
seguinte, que os reconhece pelo arquivo `~/.acutis/runtime/pids` e os derruba antes de subir os
novos.
