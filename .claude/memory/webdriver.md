---
name: webdriver
description: Webdriver em core/webdriver — gravador, runner, vídeo, WebSocket e pill injetável
metadata:
  type: feedback
---

Índice do webdriver. O Playwright controla o navegador real; a pill fica em `core/webdriver/pill/` e o WebSocket em `server/routes/ws.ts`. Ler a sub-memória do assunto antes de mexer.

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [webdriver-tdd](webdriver-tdd.md) | Teste SEMPRE antes da implementação — Vitest (UI/pill) + Playwright (E2E real, sem extensão de navegador) |
| [webdriver-rede](webdriver-rede.md) | Antes de pensar em gravar a rede para gerar `waitForResponse`: já foi feito, medido e recusado |

## Gotchas

- **CDP para um Chrome já aberto** (`RECORDER_CDP_URL`): serve para gravar na sessão logada do usuário, em vez de subir um Chromium novo. O DevTools do Chrome rejeita requisições com header `Host` que não seja IP ou `localhost`, então o recorder resolve o hostname para IP antes do `connectOverCDP` (IPv4 preferido). No modo CDP o `stop()` fecha só a aba e desconecta — nunca fechar o browser do usuário.
