#!/usr/bin/env bash
#
# Prova que o bundle montado funciona: sobe os três serviços exatamente como o app faz — mesmos
# binários, mesmas variáveis, estado fora do bundle — e exercita os caminhos que dependem de coisa
# que não é código nosso.
#
#   ./desktop/scripts/bundle-smoke.sh
#
# Não abre janela: o que a janela faz é apontar para o frontend, e isso é o `cargo test` que cobre.
# Aqui interessa se php, node, Playwright e git funcionam de dentro do bundle.
set -uo pipefail

cd "$(dirname "$0")/../.."

RES="$PWD/desktop/resources"
STATE=$(mktemp -d)
PIDS=''
FAILED=0

info() { printf '\033[32m==>\033[0m %s\n' "$1"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { printf '  \033[31m✗\033[0m %s\n' "$1"; FAILED=1; }

cleanup() {
    for pid in $PIDS; do
        kill -TERM "$pid" 2>/dev/null
        wait "$pid" 2>/dev/null
    done

    rm -rf "$STATE"
}
trap cleanup EXIT

[ -x "$RES/php" ] || { echo "monte o bundle antes: ./desktop/scripts/bundle-resources.sh" >&2; exit 1; }

# --- estado, como o app monta -------------------------------------------------
mkdir -p "$STATE/runtime/storage/framework/cache/data" \
         "$STATE/runtime/storage/framework/sessions" \
         "$STATE/runtime/storage/framework/views" \
         "$STATE/runtime/storage/logs" \
         "$STATE/runtime/storage/app/private" \
         "$STATE/runtime/logs" \
         "$STATE/projetos"
touch "$STATE/runtime/database.sqlite"

port() { node -e 'const s=require("net").createServer();s.listen(0,"127.0.0.1",()=>{console.log(s.address().port);s.close()})'; }

BACKEND_PORT=$(port); FRONTEND_PORT=$(port); WEBDRIVER_PORT=$(port)
BACKEND_URL="http://127.0.0.1:$BACKEND_PORT"
FRONTEND_URL="http://127.0.0.1:$FRONTEND_PORT"
WEBDRIVER_URL="http://127.0.0.1:$WEBDRIVER_PORT"

export APP_KEY="base64:$(head -c 32 /dev/urandom | base64)"
export APP_ENV=production APP_DEBUG=false
export LARAVEL_STORAGE_PATH="$STATE/runtime/storage"
export DB_CONNECTION=sqlite DB_DATABASE="$STATE/runtime/database.sqlite"
export ACUTIS_PROJECTS_PATH="$STATE/projetos"
export SESSION_DRIVER=database CACHE_STORE=database

# --- migrações ----------------------------------------------------------------
info 'migrando'
WEBDRIVER_URL="$WEBDRIVER_URL" "$RES/php" "$RES/backend/artisan" migrate --force \
    > "$STATE/runtime/logs/migrate.log" 2>&1 \
    || { cat "$STATE/runtime/logs/migrate.log"; bad 'migrate falhou'; exit 1; }
ok 'banco criado fora do bundle'

# --- serviços -----------------------------------------------------------------
info 'subindo os três serviços'

(cd "$RES/backend" && WEBDRIVER_URL="$WEBDRIVER_URL" \
    "$RES/php" artisan serve --host=127.0.0.1 --port="$BACKEND_PORT" --no-reload \
    > "$STATE/runtime/logs/backend.log" 2>&1) & PIDS="$PIDS $!"

(cd "$RES/webdriver" && PORT="$WEBDRIVER_PORT" CORS_ORIGIN="$FRONTEND_URL" \
    WEBDRIVER_TEST_MODE=1 RECORDER_CDP_URL='' \
    PLAYWRIGHT_BROWSERS_PATH="$RES/browsers" \
    ACUTIS_PLAYWRIGHT_CLI="$RES/webdriver/node_modules/playwright/cli.js" \
    "$RES/node" dist/main.js > "$STATE/runtime/logs/webdriver.log" 2>&1) & PIDS="$PIDS $!"

(cd "$RES/frontend" && NITRO_PORT="$FRONTEND_PORT" NITRO_HOST=127.0.0.1 \
    NUXT_API_ACUTIS_URL="$BACKEND_URL" NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL="$WEBDRIVER_URL" \
    "$RES/node" .output/server/index.mjs > "$STATE/runtime/logs/frontend.log" 2>&1) & PIDS="$PIDS $!"

wait_for() {
    for _ in $(seq 1 60); do
        curl -fsS -o /dev/null --max-time 2 "$1" 2>/dev/null && return 0
        sleep 1
    done
    return 1
}

for pair in "backend:$BACKEND_URL/up" "webdriver:$WEBDRIVER_URL/health" "frontend:$FRONTEND_URL"; do
    name=${pair%%:*}; url=${pair#*:}

    if wait_for "$url"; then
        ok "$name respondeu"
    else
        bad "$name não respondeu"
        tail -20 "$STATE/runtime/logs/$name.log"
        exit 1
    fi
done

# --- o que depende de binário de fora do nosso código -------------------------
info 'exercitando os caminhos que dependem do bundle'

GIT=$(curl -fsS "$BACKEND_URL/api/v1/settings/capabilities" | node -pe 'JSON.parse(require("fs").readFileSync(0,"utf8")).git')
[ "$GIT" = 'true' ] && ok 'git detectado' || bad "git não detectado (respondeu $GIT)"

curl -fsS -X POST "$BACKEND_URL/api/v1/projects/create/template" \
    -H 'Content-Type: application/json' -H 'Accept: application/json' \
    -d '{"name":"Fumaca"}' > "$STATE/projeto.json" 2>&1 \
    && ok 'projeto criado de template' || { bad 'criar projeto falhou'; cat "$STATE/projeto.json"; }

curl -fsS -X POST "$BACKEND_URL/api/v1/projects/create/clone" \
    -H 'Content-Type: application/json' -H 'Accept: application/json' \
    -d '{"url":"https://github.com/octocat/Hello-World.git","name":"Clonado","auth":"public"}' \
    > "$STATE/clone.json" 2>&1 \
    && ok 'repositório público clonado' || { bad 'clone falhou'; cat "$STATE/clone.json"; }

# O Playwright do bundle rodando de verdade: é o que o `npx` fazia, e o que quebraria na máquina do
# usuário sem node no PATH.
PLAYWRIGHT_VERSION=$(PLAYWRIGHT_BROWSERS_PATH="$RES/browsers" \
    "$RES/node" "$RES/webdriver/node_modules/playwright/cli.js" --version 2>&1)
case "$PLAYWRIGHT_VERSION" in
    Version*) ok "playwright do bundle executa ($PLAYWRIGHT_VERSION)" ;;
    *) bad "playwright do bundle não executa: $PLAYWRIGHT_VERSION" ;;
esac

# O chromium precisa abrir: sem ele não há gravação nem execução de teste.
BROWSER=$(PLAYWRIGHT_BROWSERS_PATH="$RES/browsers" NODE_PATH="$RES/webdriver/node_modules" \
    "$RES/node" -e "
        const { chromium } = require('$RES/webdriver/node_modules/playwright');
        chromium.launch({ headless: true })
            .then(async b => { const v = b.version(); await b.close(); console.log('ok', v) })
            .catch(e => console.log('erro', e.message))
    " 2>&1)
case "$BROWSER" in
    ok*) ok "chromium do bundle abre ($BROWSER)" ;;
    *) bad "chromium do bundle não abre: $BROWSER" ;;
esac

echo
[ "$FAILED" = 0 ] && info 'bundle de pé' || { printf '\033[31m==>\033[0m bundle com falhas\n'; exit 1; }
