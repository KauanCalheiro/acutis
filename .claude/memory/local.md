---
name: local
description: Modo de execução local — serviços direto no host (PHP/Node/Composer/pnpm), sem Docker
metadata:
  type: feedback
---

Um dos dois modos de execução (ver [execution](execution.md); a alternativa é [docker](docker.md)). Precisa ter instalado no host: PHP 8.5+, Composer, Node 24+, pnpm. Sem remapeamento de porta como no Docker — cada serviço sobe na porta default do próprio framework: backend `:8000`, frontend `:3000`, webdriver `:4000`. Os runtime configs (`frontend/nuxt.config.ts`, `webdriver/src/config/env.ts`) já apontam pra esses defaults entre si — não precisa setar env extra pros três se falarem.

**Why:** [e2e](e2e.md) sempre roda assim — `pnpm test` sobe backend/frontend/webdriver como processos filhos no host, não usa o compose. As mesmas instruções servem tanto pra rodar a stack local pra dev quanto pro que o e2e faz por baixo dos panos.

**How to apply:**

### Backend (Laravel)

```sh
cd backend
composer install
cp .env.example .env   # se ainda não existir
php artisan key:generate
touch database/database.sqlite
php artisan migrate
php artisan serve   # :8000
```

### Frontend (Nuxt)

```sh
cd frontend
pnpm install
pnpm dev   # :3000
```

### Webdriver (NestJS)

```sh
cd webdriver
pnpm install
pnpm dev   # :4000
```

- **`pnpm dev` do webdriver NÃO é watch mode** (diferente do que o entrypoint do Docker faz com `node --watch`) — é só `node --import @swc-node/register/esm-register src/main.ts` de uma vez, o processo não recarrega sozinho. Editou algo em `webdriver/src/**`, mata o processo (`Ctrl+C` ou `pkill -f main.ts`) e sobe de novo — senão o processo continua servindo o código antigo indefinidamente, silenciosamente.
- Sem a env `RECORDER_CDP_URL`, o recorder abre o próprio Chromium headed em vez de conectar num Chrome externo via CDP (diferente do modo Docker, que depende do Chrome do host).
- Setup e seed do banco dedicado do e2e (`database/e2e.sqlite`, `migrate:fresh --seed`) já é automatizado pelo `e2e/scripts/setup.sh` (roda como `pretest` do `e2e/package.json`) — não precisa fazer manual, só `pnpm test` dentro de `e2e/`.
