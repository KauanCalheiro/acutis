---
name: e2e-running-permission
description: Rodar a suíte E2E só quando o usuário pedir; backend, lint e typecheck podem rodar à vontade
metadata:
  type: feedback
---

**Não rodar E2E por conta própria.** `pnpm exec playwright test` só quando o usuário pedir explicitamente.

**Why:** cada rodada leva minutos, sobe três serviços e ocupa o terminal. Quem decide quando pagar esse custo é o usuário.

**How to apply:** ao terminar uma mudança que toca o frontend, rodar `pnpm lint`, `pnpm typecheck` e a suíte do backend (que são rápidas), escrever ou ajustar o teste E2E que a mudança pede e **parar aí**, dizendo que o E2E está escrito e esperando ordem para rodar. Ver [e2e-running](e2e-running.md) para os comandos.
