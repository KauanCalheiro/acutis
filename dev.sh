#!/usr/bin/env bash
#
# Sobe a stack acutis 100% local e fica preso, com os logs dos três serviços
# intercalados e prefixados. Ctrl+C derruba tudo. É o equivalente local do
# `docker compose -f docker-compose.dev.yml up`.
#
#   ./dev.sh              sobe backend :8000, frontend :3000, webdriver :4000
#   ./dev.sh --build      instala dependências e prepara o banco antes de subir
#   ./dev.sh --headless   grava sem abrir janela (útil quando um agente dirige a ferramenta)
#
set -uo pipefail

cd "$(dirname "$0")"

BUILD=0
HEADLESS=0

for arg in "$@"; do
    case "$arg" in
        --build) BUILD=1 ;;
        --headless) HEADLESS=1 ;;
        *) echo "opção desconhecida: $arg" >&2; exit 1 ;;
    esac
done

if [ -t 1 ]; then
    C_BACK=$'\033[36m'; C_FRONT=$'\033[35m'; C_DRIVER=$'\033[33m'
    C_INFO=$'\033[32m'; C_WARN=$'\033[31m'; C_OFF=$'\033[0m'
else
    C_BACK=''; C_FRONT=''; C_DRIVER=''; C_INFO=''; C_WARN=''; C_OFF=''
fi

info() { printf '%s==>%s %s\n' "$C_INFO" "$C_OFF" "$1"; }
fail() { printf '%s==>%s %s\n' "$C_WARN" "$C_OFF" "$1" >&2; exit 1; }

# --- pré-requisitos -----------------------------------------------------------
for tool in php composer node pnpm; do
    command -v "$tool" >/dev/null 2>&1 || fail "$tool não encontrado no PATH. Instale-o antes de rodar local."
done

# Só quem ESCUTA na porta importa: `lsof -ti tcp:3000` casa conexões de navegador
# também e acusa porta ocupada quando não há servidor nenhum.
for port in 8000 3000 4000; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        fail "porta $port já está em uso. Derrube o que está lá (ou o compose) antes."
    fi
done

# --- build opcional -----------------------------------------------------------
if [ "$BUILD" = "1" ]; then
    info 'instalando dependências do backend'
    (cd backend && composer install --no-interaction) || fail 'composer install falhou'

    [ -f backend/.env ] || cp backend/.env.example backend/.env
    grep -q '^APP_KEY=.\+' backend/.env || (cd backend && php artisan key:generate)
    touch backend/database/database.sqlite

    info 'migrando o banco'
    (cd backend && php artisan migrate --force) || fail 'migrate falhou'

    for app in frontend webdriver; do
        info "instalando dependências do $app"
        (cd "$app" && pnpm install) || fail "pnpm install falhou em $app"
    done
fi

# --- serviços -----------------------------------------------------------------
# set -m coloca cada job no próprio process group, então o Ctrl+C mata a árvore
# inteira (php/pnpm sobem filhos) sem depender de pkill por padrão de nome.
set -m

PIDS=''
WATCHER=''

start() {
    local name="$1" color="$2" dir="$3"; shift 3

    (
        cd "$dir" || exit 1
        "$@" 2>&1 | while IFS= read -r line; do
            printf '%s%-9s%s %s\n' "$color" "$name" "$C_OFF" "$line"
        done
    ) &

    PIDS="$PIDS $!"
}

shutdown() {
    trap '' INT TERM
    printf '\n'
    info 'derrubando os serviços'

    [ -n "$WATCHER" ] && kill -TERM -"$WATCHER" 2>/dev/null

    for pid in $PIDS; do
        kill -TERM -"$pid" 2>/dev/null
    done
    for pid in $PIDS; do
        wait "$pid" 2>/dev/null
    done

    info 'tudo parado'
    exit 0
}

trap shutdown INT TERM

start backend  "$C_BACK"   backend   php artisan serve
start frontend "$C_FRONT"  frontend  pnpm dev
# WEBDRIVER_TEST_MODE=1 não é opcional: sem ela os endpoints /runner/* respondem
# 403 e o botão "Testar" da interface não funciona.
start webdriver "$C_DRIVER" webdriver env WEBDRIVER_TEST_MODE=1 RECORDER_HEADLESS="$HEADLESS" pnpm dev

# --- espera ficar de pé -------------------------------------------------------
(
    ready() { curl -fsS -o /dev/null --max-time 2 "$1" 2>/dev/null; }

    for _ in $(seq 1 60); do
        if ready http://localhost:8000/api/v1/projects &&
           ready http://localhost:3000 &&
           ready http://localhost:4000/health; then
            printf '\n%s==>%s stack de pé\n' "$C_INFO" "$C_OFF"
            printf '    backend    http://localhost:8000\n'
            printf '    frontend   http://localhost:3000\n'
            printf '    webdriver  http://localhost:4000\n\n'
            exit 0
        fi
        sleep 2
    done

    printf '%s==>%s algum serviço não respondeu em 2min — veja os logs acima\n' "$C_WARN" "$C_OFF"
) &
WATCHER=$!

wait
