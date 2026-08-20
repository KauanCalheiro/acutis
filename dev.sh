#!/usr/bin/env bash
#
# Sobe a aplicação Nitro completa e fica preso. Ctrl+C derruba tudo.
#
#   ./dev.sh              sobe interface + API + gravador + runner em :3000
#   ./dev.sh --build      instala as dependências antes de subir
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
    C_INFO=$'\033[32m'; C_WARN=$'\033[31m'; C_OFF=$'\033[0m'
else
    C_INFO=''; C_WARN=''; C_OFF=''
fi

info() { printf '%s==>%s %s\n' "$C_INFO" "$C_OFF" "$1"; }
fail() { printf '%s==>%s %s\n' "$C_WARN" "$C_OFF" "$1" >&2; exit 1; }

# --- pré-requisitos -----------------------------------------------------------
for tool in node pnpm; do
    command -v "$tool" >/dev/null 2>&1 || fail "$tool não encontrado no PATH. Instale-o antes de rodar local."
done

# Só quem ESCUTA na porta importa: `lsof -ti tcp:3000` casa conexões de navegador
# também e acusa porta ocupada quando não há servidor nenhum.
for port in 3000; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
        fail "porta $port já está em uso. Derrube o que está lá antes."
    fi
done

# --- build opcional -----------------------------------------------------------
if [ "$BUILD" = "1" ]; then
    # Não há mais banco a preparar: o SQLite das configurações nasce sozinho na primeira
    # requisição, e o resto do estado vive no filesystem e no git.
    # Um install só cobre o workspace inteiro.
    info 'instalando dependências do workspace'
    pnpm install || fail 'pnpm install falhou'
fi

# --- serviços -----------------------------------------------------------------
# set -m coloca cada job no próprio process group, então o Ctrl+C mata a árvore
# inteira (o pnpm sobe filhos) sem depender de pkill por padrão de nome.
set -m

PIDS=''
WATCHER=''

# A saída dos serviços não vai para o terminal: o único conteúdo é o banner. Os logs
# ficam em .acutis/<serviço>.log (pasta já ignorada pelo git) para quando algo quebrar.
LOGDIR=.acutis
mkdir -p "$LOGDIR"

start() {
    local name="$1"; shift

    (exec "$@" >"$LOGDIR/$name.log" 2>&1) &

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

start acutis env RECORDER_HEADLESS="$HEADLESS" pnpm dev

node bin/splash.mjs http://localhost:3000

# --- espera ficar de pé -------------------------------------------------------
# Em silêncio: só abre a boca se algum serviço não subir.
(
    ready() { curl -fsS -o /dev/null --max-time 2 "$1" 2>/dev/null; }

    for _ in $(seq 1 60); do
        if ready http://localhost:3000/api/projects; then
            exit 0
        fi
        sleep 2
    done

    printf '%s==>%s algum serviço não respondeu em 2min — logs em %s/\n' "$C_WARN" "$C_OFF" "$LOGDIR" >&2
) &
WATCHER=$!

wait
