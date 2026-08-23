---
paths:
  - "core/webdriver/**"
  - "server/routes/**"
---

O Playwright controla o navegador real; a pill fica em `core/webdriver/pill/` e o WebSocket em `server/routes/ws.ts`.

## Gotchas

- **CDP para um Chrome já aberto** (`RECORDER_CDP_URL`): serve para gravar na sessão logada do usuário, em vez de subir um Chromium novo. O DevTools do Chrome rejeita requisições com header `Host` que não seja IP ou `localhost`, então o recorder resolve o hostname para IP antes do `connectOverCDP` (IPv4 preferido). No modo CDP o `stop()` fecha só a aba e desconecta — nunca fechar o browser do usuário.
