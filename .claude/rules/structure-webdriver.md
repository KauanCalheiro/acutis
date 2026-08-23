---
paths:
  - "core/webdriver/**"
  - "server/routes/**"
---

Playwright controla o navegador real por automação, sem extensão e sem API de captura da página.

```
core/webdriver/
├── recorder/              # browser, contexto, página e screencast
├── runner/                # execução e transmissão do Playwright
├── video/                 # armazenamento de webm
├── gateway/               # tipos e envio de eventos
└── pill/                  # UI Vue injetada pelo recorder

server/routes/
├── ws.ts                  # gateway WebSocket
├── recording/             # vídeo da gravação
├── runner/                # execução e vídeo do runner
└── debug/                 # automação disponível em modo de teste
```

**Comandos:** `pnpm build:recorder` · `pnpm test` · `pnpm typecheck` · `pnpm test:e2e`
