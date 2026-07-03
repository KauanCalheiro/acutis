---
name: structure
description: Onde fica cada coisa no monorepo — backend Laravel, frontend Nuxt, webdriver NestJS, e2e; ler ao procurar arquivo/pasta
metadata:
  type: project
---

Monorepo com quatro subprojetos independentes.

## Raiz

```
acutis/
├── CLAUDE.md
├── README.md
├── backend/                # Laravel 13 / PHP 8.5
├── frontend/               # Nuxt 4 + Nuxt UI 4 / TypeScript / pnpm
├── webdriver/              # NestJS + Playwright real — grava tela/eventos, injeta a pill
└── e2e/                    # Playwright cross-tool (frontend + webdriver reais)
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

Nuxt 4, TypeScript, pnpm. Nuxt UI v4. `/record` conecta direto no gateway WS do webdriver (`ws://localhost:4000/ws`).

```
frontend/
├── nuxt.config.ts
├── app/
│   ├── assets/
│   ├── layouts/
│   ├── pages/              # record.vue: eventos ao vivo + player do vídeo
│   └── components/
└── server/                 # Nitro (proxy / SSE)
```

**Comandos:** `pnpm dev` (porta 3000) · `pnpm typecheck` · `pnpm lint`

## webdriver/

NestJS (porta 4000), Playwright controlando o navegador de verdade (`recordVideo`/`page.screencast` — sem pedir permissão, é canal de automação, não API web). Substituiu a extensão Chrome removida.

```
webdriver/
├── src/
│   ├── main.ts / app.module.ts
│   ├── config/              # env, paths (VIDEOS_DIR, RECORDER_BUNDLE_PATH)
│   ├── ws/                  # RecorderGateway (@WebSocketGateway) + adapter customizado por `type`
│   ├── recorder/            # RecorderService (browser/context/page, screencast) + DebugController (só com WEBDRIVER_TEST_MODE=1)
│   ├── video/               # VideoService/Controller — serve o .webm direto
│   ├── types/                # RecordingEvent/RecordingSelectors (recording.ts) + OutgoingMessage (ws.ts)
│   └── ui/                  # pill/recorder (Vue), injetada via addInitScript — build separado (vite.ui.config.ts → dist-ui/)
├── tsconfig.json             # server (exclui src/ui)
└── tsconfig.ui.json          # UI (@/* → src/*)
```

**Comandos:** `pnpm dev` (server, porta 4000) · `pnpm build && pnpm start` (prod) · `pnpm build:ui` (bundle da pill) · `pnpm test` (Vitest da UI) · `pnpm typecheck` / `pnpm typecheck:ui`

## e2e/

Playwright cross-tool: sobe o webdriver real (como processo filho em teste) + o frontend real (`pnpm dev` via `webServer` do Playwright config) e valida o fluxo de gravação de ponta a ponta.

**Comandos:** `pnpm test` (builda a UI do webdriver antes)
