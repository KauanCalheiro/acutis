#!/bin/sh
set -e

cd "$(dirname "$0")/../../backend"

composer install --quiet
[ -f .env ] || cp .env.example .env
if grep -q '^APP_KEY=$' .env; then
    php artisan key:generate --ansi -q
fi
touch database/e2e.sqlite
DB_DATABASE=database/e2e.sqlite php artisan migrate:fresh --seed --force

cd ../frontend
pnpm build
