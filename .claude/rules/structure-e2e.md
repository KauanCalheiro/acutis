---
paths:
  - "e2e/**"
---

Playwright cross-tool: sobe o webdriver real (como processo filho em teste) + o frontend real (`pnpm dev` via `webServer` do Playwright config) e valida o fluxo de gravação de ponta a ponta.

**Comandos:** `pnpm test` (builda a UI do webdriver antes)
