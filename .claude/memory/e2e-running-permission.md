---
name: e2e-running-permission
description: Rodar sempre o teste E2E que foi mexido, nunca a suíte inteira sem o usuário pedir
metadata:
  type: feedback
---

**Escreveu ou alterou um teste E2E? Rodar aquele teste, sempre**, antes de dizer que a mudança está pronta — escopado no que foi mexido, com `--grep` no título do teste ou no `describe`:

```sh
cd e2e
pnpm exec playwright test --grep "creates a project from the template"
pnpm exec playwright test tests/home.spec.ts
```

**A suíte inteira (`pnpm test`, ou `playwright test` sem escopo) só quando o usuário pedir.**

**Why:** entregar teste escrito e não executado é entregar suposição — o usuário perguntou "eles foram executados?" depois de três mudanças em que só o lint e o typecheck tinham rodado. Rodar o teste específico custa segundos; é a suíte inteira que custa minutos e ocupa o terminal, e é só essa que o usuário decide quando pagar.

**How to apply:** ao terminar uma mudança que toca o frontend, rodar `pnpm lint`, `pnpm typecheck`, a suíte do backend e o teste E2E específico da mudança. Reportar o resultado real da execução; se o teste falhar, corrigir antes de entregar. Ver [e2e-running](e2e-running.md) para as armadilhas do `--grep` e do build no `pretest`.
