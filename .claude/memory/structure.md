---
name: structure
description: Onde fica cada coisa no monorepo — índice por subprojeto; ler ao procurar arquivo/pasta (→ backend, frontend, webdriver, e2e)
metadata:
  type: project
---

Monorepo com quatro subprojetos independentes. Comandos rodam dentro do container, nunca no host — ver [docker](docker.md).

```
acutis/
├── CLAUDE.md
├── README.md
├── backend/                # Laravel 13 / PHP 8.5
├── frontend/               # Nuxt 4 + Nuxt UI 4 / TypeScript / pnpm
├── webdriver/              # NestJS + Playwright real — grava tela/eventos, injeta a pill
└── e2e/                    # Playwright cross-tool (frontend + webdriver reais)
```

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [structure-backend](structure-backend.md) | Pastas de `app/Http`, `database`, `routes`, `tests`; comandos artisan/pint |
| [structure-frontend](structure-frontend.md) | Pastas de `app/`, `server/`; comandos pnpm |
| [structure-webdriver](structure-webdriver.md) | Pastas de `src/ws`, `recorder`, `video`, `ui`; comandos pnpm |
| [structure-e2e](structure-e2e.md) | Playwright cross-tool, comando pnpm |
