---
name: structure
description: Onde fica cada coisa no monorepo — backend Laravel, frontend Nuxt, docs; ler ao procurar arquivo/pasta
metadata:
  type: project
---

Monorepo com três subprojetos independentes.

## Raiz

```
acutis/
├── CLAUDE.md
├── README.md
├── backend/                # Laravel 13 / PHP 8.5
├── frontend/               # Nuxt 4 + Nuxt UI 4 / TypeScript / pnpm
└── extension/              # (vazia — futura Vue 3 IIFE)
```

## backend/

Laravel 13, PHP 8.5. API REST. SQLite como banco de dados. `APP_URL=http://localhost:8000`.

```
backend/
├── app/
│   ├── Http/Controllers/
│   ├── Models/
│   └── Providers/
├── database/
│   ├── migrations/
│   ├── factories/
│   └── seeders/
├── routes/
│   └── api.php
└── tests/
    ├── Feature/
    └── Unit/
```

**Comandos:** `php artisan serve` · `php artisan test` · `./vendor/bin/pint`

## frontend/

Nuxt 4, TypeScript, pnpm. Nuxt UI v4.

```
frontend/
├── nuxt.config.ts
├── app/
│   ├── assets/
│   ├── layouts/
│   ├── pages/
│   └── components/
└── server/                 # Nitro (proxy / WebSocket / SSE)
```

**Comandos:** `pnpm dev` (porta 3000) · `pnpm typecheck` · `pnpm lint`

## extension/

Pasta reservada para extensão Vue 3 IIFE — injetada via Playwright `page.evaluate`. Vazia no momento.
