---
name: structure-webdriver
description: Estrutura de pastas do webdriver NestJS — ws/recorder/video/ui; comandos pnpm dev/build/test
metadata:
  type: project
---

NestJS, Playwright controlando o navegador de verdade (`recordVideo`/`page.screencast` — sem pedir permissão, é canal de automação, não API web). Substituiu a extensão Chrome removida.

```
backend/
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
