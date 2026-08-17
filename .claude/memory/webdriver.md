---
name: webdriver
description: Serviço webdriver (backend/, era webdriver/) — LER 1º ao mexer no NestJS (gateway/recorder/video) ou na UI/pill injetável; índice → tdd
metadata:
  type: feedback
---

Índice do webdriver (NestJS, Playwright real controlando o navegador; UI/pill em `src/webdriver/pill/` via Vite+Vue). Ler a sub-memória do assunto antes de mexer. Estrutura de pastas em [structure-webdriver](structure-webdriver.md).

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [webdriver-tdd](webdriver-tdd.md) | Teste SEMPRE antes da implementação — Vitest (UI/pill) + Playwright (E2E real, sem extensão de navegador) |

## Gotchas

- **CDP para um Chrome já aberto** (`RECORDER_CDP_URL`): serve para gravar na sessão logada do usuário, em vez de subir um Chromium novo. O DevTools do Chrome rejeita requisições com header `Host` que não seja IP ou `localhost`, então o recorder resolve o hostname para IP antes do `connectOverCDP` (IPv4 preferido). No modo CDP o `stop()` fecha só a aba e desconecta — nunca fechar o browser do usuário.
