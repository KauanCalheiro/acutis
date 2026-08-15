---
name: structure-webdriver
description: Estrutura de pastas do backend NestJS — common/modules/webdriver; comandos pnpm dev/build/test
metadata:
  type: project
---

NestJS, Playwright controlando o navegador de verdade (`recordVideo`/`page.screencast` — sem pedir permissão, é canal de automação, não API web). Substituiu a extensão Chrome removida.

```
backend/
├── src/
│   ├── main.ts / app.module.ts
│   ├── config/                    # env, paths (VIDEOS_DIR, RECORDER_BUNDLE_PATH)
│   ├── common/                    # filters, pipes, interceptors, exceptions, utils, playwright, types
│   ├── modules/                   # a API /api/v1 — um módulo Nest por domínio
│   └── webdriver/
│       ├── gateway/               # RecorderGateway (@WebSocketGateway) + adapter customizado por `type`
│       ├── recorder/              # RecorderService (browser/context/page, screencast) + DebugController (só com WEBDRIVER_TEST_MODE=1)
│       ├── runner/                # RunnerService — dispara e transmite a execução do Playwright
│       ├── video/                 # VideoService/Controller — serve o .webm direto
│       └── pill/                  # pill/recorder (Vue), injetada via addInitScript — build separado (vite.ui.config.ts → dist-ui/)
├── test/                          # harness, fixtures e setup do jsdom
├── vitest.config.ts               # a suíte
├── tsconfig.json                  # server (exclui src/webdriver/pill e os __tests__)
└── tsconfig.ui.json               # pill (@/* → src/*)
```

**Comandos:** `pnpm dev` (server, porta 4000) · `pnpm build && pnpm start` (prod) · `pnpm build:ui` (bundle da pill) · `pnpm test` (Vitest da UI) · `pnpm typecheck` / `pnpm typecheck:ui`
