---
name: webdriver
description: Serviço webdriver (backend/, era webdriver/) — LER 1º ao mexer no NestJS (gateway/recorder/video) ou na UI/pill injetável; índice → tdd
metadata:
  type: feedback
---

Índice do webdriver (NestJS, Playwright real controlando o navegador; UI/pill em `src/ui/` via Vite+Vue). Ler a sub-memória do assunto antes de mexer. Estrutura de pastas em [structure-webdriver](structure-webdriver.md).

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [webdriver-tdd](webdriver-tdd.md) | Teste SEMPRE antes da implementação — Vitest (UI/pill) + Playwright (E2E real, sem extensão de navegador) |

## Gotchas

- **CDP para o Chrome do host** (`RECORDER_CDP_URL`): o DevTools do Chrome rejeita requisições com header `Host` que não seja IP ou `localhost` — `host.docker.internal` puro falha com "Host header is specified and is not an IP address". O recorder resolve o hostname para IP antes do `connectOverCDP` (IPv4 preferido; o IPv6 do host.docker.internal não roteia no Docker Desktop). No modo CDP o `stop()` fecha só a aba e desconecta — nunca fechar o browser do usuário.
