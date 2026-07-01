---
paths:
  - "frontend/app/components/**/*.vue"
  - "frontend/app/pages/**/*.vue"
---

**Invariant:** todo elemento **interativo** (input, button, select, link/clicável, item de menu) DEVE ter `data-testid` no padrão `<recurso>-<acao>` (ex.: `categoria-busca`, `categoria-filtro-aplicar`). Interativo sem `data-testid` = estado inválido — os testes E2E selecionam por `getByTestId`. Itens de menu sem hook nativo (ex.: `UDropdownMenu`) expõem o testid via slot.

@.claude/memories/e2e/setup.md
