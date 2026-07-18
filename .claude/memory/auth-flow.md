---
name: auth-flow
description: TODO — testes e2e do fluxo de autenticação do projeto estão desativados (skip), reativar e verificar depois
metadata:
  type: todo
---

Item do [índice de TODOs](todo.md). Testes e2e do fluxo de autenticação do projeto (alerta "sem autenticação configurada", botão/modal de configurar, gravação de login) foram desativados com `test.skip`/`test.describe.skip` — nenhum código foi apagado, só marcado como skip:

- `e2e/tests/project.spec.ts`:
  - `shows the authentication button in the header`
  - `shows an alert when the project has no authentication configured`
  - `opens the auth modal from the alert`
  - `describe('project authentication modal', ...)` inteiro (4 testes: carrega script existente, edita e salva, "record again", cancela)
  - `dismisses the alert when the project does not need login`
  - `hides the alert once authentication is configured`
- `e2e/tests/recording.spec.ts`:
  - `describe('recording authentication from the project page', ...)` inteiro (grava login e gera o setup de auth)

Backend não foi tocado — os testes de backend relacionados a auth continuam ativos normalmente.

**Why:** pedido explícito do usuário pra pausar a cobertura desse fluxo temporariamente, sem detalhar o motivo — registrar aqui pra não esquecer de reverter.

**How to apply:** antes de considerar o fluxo de autenticação do projeto estável de novo, reverter os `.skip` (`test.describe.skip` → `test.describe`, `test.skip` → `test`) nos dois arquivos acima e rodar `pnpm test` dentro de `e2e/` pra confirmar que passam. Depois de reverter e confirmar, apagar esta memória.
