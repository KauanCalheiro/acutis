---
name: run-local
description: Use when the user wants to run, start, boot, or serve the acutis stack 100% locally (direct host processes, no Docker) — backend Laravel :8000, frontend Nuxt :3000, webdriver NestJS :4000. Triggers on "rodar local", "subir local", "run local", "start the app locally".
---

# Rodar a stack acutis 100% local

Sobe backend, frontend e webdriver como processos diretos no host (sem Docker). É o mesmo modo que o e2e usa por baixo. Esta skill é a fonte de verdade dos comandos do modo local.

**Não misturar com Docker no mesmo serviço/host** (conflito de porta/estado). Se o compose estiver de pé, derrubar antes (`docker compose -f docker-compose.dev.yml down`).

## Pré-requisitos no host

PHP 8.5+, Composer, Node 24+, pnpm. Checar antes de subir:

```sh
php -v && composer --version && node -v && pnpm -v
```

Faltando algum → parar e avisar o usuário; não tentar instalar runtime.

## Portas (defaults do framework, sem remap)

| Serviço | Porta | URL |
|---------|-------|-----|
| backend (Laravel) | 8000 | http://localhost:8000 |
| frontend (Nuxt) | 3000 | http://localhost:3000 |
| webdriver (NestJS) | 4000 | http://localhost:4000 |

Os configs (`frontend/nuxt.config.ts`, `webdriver/src/config/env.ts`) já apontam pra esses defaults entre si — não setar env extra.

## Setup de primeira vez — backend (idempotente)

```sh
cd backend
composer install
[ -f .env ] || cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
```

Frontend e webdriver: só `pnpm install` na primeira vez (ou após mudar dependência).

## Subir os três (cada um em background)

```sh
cd backend  && php artisan serve                 # :8000
cd frontend && pnpm install && pnpm dev          # :3000
cd webdriver && pnpm install && pnpm dev         # :4000
```

Lançar cada um com `run_in_background`, depois confirmar que respondem (curl na URL) antes de reportar pronto.

## Reiniciar depois de editar

- **backend / frontend**: hot reload, não precisa reiniciar.
- **webdriver**: `pnpm dev` **NÃO é watch mode** — é `node` de uma vez só. Editou `webdriver/src/**` → matar (`pkill -f main.ts`) e subir de novo, senão serve código antigo silenciosamente.

## Notas

- Sem `RECORDER_CDP_URL`, o recorder abre o próprio Chromium headed (não depende de Chrome externo, diferente do Docker).
- E2E: não precisa subir nada à mão — `pnpm test` dentro de `e2e/` sobe os três como processos filhos e faz o seed do `database/e2e.sqlite` sozinho (`e2e/scripts/setup.sh` como `pretest`).
