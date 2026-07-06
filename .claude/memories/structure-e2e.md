---
name: structure-e2e
description: Estrutura do e2e — Playwright cross-tool subindo webdriver e frontend reais; comando pnpm test
metadata:
  type: project
---

Playwright cross-tool: sobe o webdriver real (como processo filho em teste) + o frontend real (`pnpm dev` via `webServer` do Playwright config) e valida o fluxo de gravação de ponta a ponta.

**Comandos:** `pnpm test` (builda a UI do webdriver antes)
