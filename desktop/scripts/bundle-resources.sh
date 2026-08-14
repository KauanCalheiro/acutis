#!/usr/bin/env bash
#
# Monta desktop/resources/ com tudo que o app empacotado precisa levar junto: os runtimes que o
# usuário final não tem (php, node), o código dos três serviços já construído, os navegadores do
# Playwright e, no Windows, o git.
#
# Roda no CI antes do `tauri build`, e na mão para testar o bundle localmente.
#
#   ./desktop/scripts/bundle-resources.sh
#
# Cada etapa é idempotente: o que já está montado não é baixado nem construído de novo. Apague
# desktop/resources para forçar tudo do zero.
set -euo pipefail

cd "$(dirname "$0")/../.."

ROOT="$PWD"
RES="$ROOT/desktop/resources"
CACHE="$RES/.download"

# O php precisa ser o mesmo da resolução do composer, senão o platform_check.php do vendor recusa a
# rodar. Node é o LTS. Ambos são versões fixas de propósito: bundle não se atualiza sozinho.
PHP_VERSION=8.4.15
NODE_VERSION=22.20.0

info() { printf '\033[32m==>\033[0m %s\n' "$1"; }
fail() { printf '\033[31m==>\033[0m %s\n' "$1" >&2; exit 1; }

case "$(uname -s)" in
    Darwin) OS=macos ;;
    Linux)  OS=linux ;;
    MINGW*|MSYS*|CYGWIN*) OS=windows ;;
    *) fail "sistema não suportado: $(uname -s)" ;;
esac

case "$(uname -m)" in
    arm64|aarch64) ARCH=arm64 ;;
    x86_64|amd64)  ARCH=x64 ;;
    *) fail "arquitetura não suportada: $(uname -m)" ;;
esac

# static-php-cli e nodejs.org nomeiam a mesma máquina de jeitos diferentes.
case "$OS-$ARCH" in
    macos-arm64)   PHP_TARGET=macos-aarch64;  NODE_TARGET=darwin-arm64 ;;
    macos-x64)     PHP_TARGET=macos-x86_64;   NODE_TARGET=darwin-x64 ;;
    linux-x64)     PHP_TARGET=linux-x86_64;   NODE_TARGET=linux-x64 ;;
    windows-x64)   PHP_TARGET=windows-x64;    NODE_TARGET=win-x64 ;;
    *) fail "combinação não suportada: $OS-$ARCH" ;;
esac

EXE=''
[ "$OS" = windows ] && EXE='.exe'

mkdir -p "$RES" "$CACHE"

# --- php ----------------------------------------------------------------------
# A variante `common` é a que traz pdo_sqlite; a `bulk`, apesar do nome, não traz — e sem ele o
# backend não abre o banco. Conferido em 14/08/2026.
if [ ! -x "$RES/php$EXE" ]; then
    info "baixando php $PHP_VERSION ($PHP_TARGET)"

    if [ "$OS" = windows ]; then
        curl -fsSL -o "$CACHE/php.zip" \
            "https://dl.static-php.dev/static-php-cli/windows/spc-max/php-$PHP_VERSION-cli-win.zip"
        unzip -oq "$CACHE/php.zip" -d "$CACHE/php"
        cp "$CACHE/php/php.exe" "$RES/php.exe"
    else
        curl -fsSL -o "$CACHE/php.tar.gz" \
            "https://dl.static-php.dev/static-php-cli/common/php-$PHP_VERSION-cli-$PHP_TARGET.tar.gz"
        tar xzf "$CACHE/php.tar.gz" -C "$CACHE"
        mv "$CACHE/php" "$RES/php"
        chmod +x "$RES/php"
    fi
fi

# A lista sai para uma variável antes de ser filtrada: com `pipefail`, um `grep -q` fecha o pipe e
# mata o php com SIGPIPE, e o pipeline inteiro reporta falha mesmo com a extensão presente.
PHP_MODULES=$("$RES/php$EXE" -m)

case "$PHP_MODULES" in
    *pdo_sqlite*) ;;
    *) fail 'o php baixado não tem pdo_sqlite — o backend não conseguiria abrir o banco' ;;
esac

# --- node ---------------------------------------------------------------------
if [ ! -x "$RES/node$EXE" ]; then
    info "baixando node $NODE_VERSION ($NODE_TARGET)"

    if [ "$OS" = windows ]; then
        curl -fsSL -o "$CACHE/node.zip" \
            "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$NODE_TARGET.zip"
        unzip -oq "$CACHE/node.zip" -d "$CACHE"
        cp "$CACHE/node-v$NODE_VERSION-$NODE_TARGET/node.exe" "$RES/node.exe"
    else
        curl -fsSL -o "$CACHE/node.tar.gz" \
            "https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-$NODE_TARGET.tar.gz"
        tar xzf "$CACHE/node.tar.gz" -C "$CACHE"
        cp "$CACHE/node-v$NODE_VERSION-$NODE_TARGET/bin/node" "$RES/node"
        chmod +x "$RES/node"
    fi
fi

# --- git (só onde o sistema costuma não ter) ----------------------------------
# macOS e Linux praticamente sempre têm git; o app detecta e, na falta, desabilita a importação de
# repositório. Windows é o alvo onde faltar é a regra, então lá o git viaja junto.
if [ "$OS" = windows ] && [ ! -d "$RES/git" ]; then
    info 'baixando MinGit'

    MINGIT_RELEASE=$(curl -fsSL https://api.github.com/repos/git-for-windows/git/releases/latest)
    MINGIT_URL=$(printf '%s' "$MINGIT_RELEASE" \
        | grep -o 'https://[^"]*MinGit-[^"]*-64-bit\.zip' \
        | grep -v busybox \
        | sed -n '1p')

    [ -n "$MINGIT_URL" ] || fail 'não achei o MinGit na última release do git-for-windows'

    curl -fsSL -o "$CACHE/mingit.zip" "$MINGIT_URL"
    unzip -oq "$CACHE/mingit.zip" -d "$RES/git"
fi

# --- backend ------------------------------------------------------------------
# O composer roda com o php que vai no bundle: o vendor guarda a versão que resolveu, e um php mais
# velho que ela é recusado pelo platform_check.php na primeira execução do usuário.
info 'construindo o backend'
rm -rf "$RES/backend"
mkdir -p "$RES/backend"

# tests/ e o sqlite de desenvolvimento não têm o que fazer na máquina do usuário; storage/ e o banco
# nascem em ~/.acutis no primeiro boot. vendor/ é reinstalado na cópia logo abaixo.
# .acutis/ é projeto de quem desenvolve o acutis: mandá-lo junto entregaria dado de uma máquina para
# a de outra pessoa.
tar -c --exclude=tests --exclude=storage --exclude=database/database.sqlite --exclude=.env \
    --exclude=.acutis --exclude=vendor \
    -C backend . | tar -x -C "$RES/backend"

# O composer roda na cópia, nunca em `backend/`: `--no-dev` lá apagaria o Pest e as demais
# ferramentas de quem desenvolve o acutis, e o estrago só apareceria na próxima vez que alguém
# rodasse a suíte.
#
# E roda com o php que vai no bundle: o vendor guarda a versão que o resolveu, e um php mais velho
# que ela é recusado pelo platform_check.php na primeira execução do usuário.
(cd "$RES/backend" && "$RES/php$EXE" "$(command -v composer)" install --no-dev --no-interaction --quiet) \
    || fail 'composer install falhou'

# --- webdriver ----------------------------------------------------------------
info 'construindo o webdriver'
rm -rf "$RES/webdriver"
mkdir -p "$RES/webdriver"

(cd webdriver && pnpm install --frozen-lockfile --silent && pnpm build && pnpm build:ui) \
    || fail 'build do webdriver falhou'

tar -c -C webdriver dist dist-ui package.json pnpm-lock.yaml pnpm-workspace.yaml reporters \
    | tar -x -C "$RES/webdriver"

# O node_modules é instalado de novo aqui, com linker hoisted, em vez de copiado: o layout padrão do
# pnpm é uma teia de symlinks para .pnpm/, e o empacotador do Tauri copia o conteúdo dos arquivos
# sem recriar link nenhum — no bundle os pacotes simplesmente sumiriam.
#
# Sem `--prod`, de propósito: `@playwright/test` está em devDependencies e é justamente o que o
# runner executa.
info 'instalando as dependências do webdriver no formato que o bundle aguenta'
(cd "$RES/webdriver" && pnpm install --node-linker=hoisted --frozen-lockfile --silent) \
    || fail 'instalação hoisted do webdriver falhou'

# --- frontend -----------------------------------------------------------------
info 'construindo o frontend'
rm -rf "$RES/frontend"
mkdir -p "$RES/frontend"

(cd frontend && pnpm install --frozen-lockfile --silent && pnpm build) || fail 'build do frontend falhou'

tar -c -C frontend .output | tar -x -C "$RES/frontend"

# --- navegadores do Playwright ------------------------------------------------
# Só o chromium: é o que o gravador abre e o que os testes gerados usam.
if [ ! -d "$RES/browsers" ]; then
    info 'baixando o chromium do Playwright'
    PLAYWRIGHT_BROWSERS_PATH="$RES/browsers" \
        pnpm --dir webdriver exec playwright install chromium || fail 'playwright install falhou'
fi

# --- payload ------------------------------------------------------------------
# O empacotador do Tauri copia o conteúdo de cada arquivo, mas não recria symlink nenhum. Isso
# quebraria duas coisas de uma vez: os pacotes do node_modules e — pior — o Chrome for Testing, cujo
# .framework no macOS é feito de symlinks internos, sem os quais o navegador não abre.
#
# Um tar preserva link e permissão. O app extrai isto no primeiro boot; o bundle leva o arquivo.
info 'empacotando o payload'
mkdir -p "$ROOT/desktop/payload"
# COPYFILE_DISABLE tira os arquivos `._*` que o tar do macOS cria para carregar xattr: são lixo em
# qualquer outro sistema, e no macOS reaparecem sozinhos quando fazem falta.
COPYFILE_DISABLE=1 tar czf "$ROOT/desktop/payload/acutis-payload.tar.gz" \
    --exclude=.download -C "$RES" .

info "recursos montados em $RES"
du -sh "$RES" "$ROOT/desktop/payload/acutis-payload.tar.gz" 2>/dev/null || true
