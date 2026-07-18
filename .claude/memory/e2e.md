---
name: e2e
description: Índice de E2E (Playwright, pasta e2e/) — LER 1º ao criar/editar teste cross-tool; índice → tags, backend, setup
metadata:
  type: feedback
---

Testes cross-tool (webdriver + frontend + backend) vivem em `e2e/` na raiz do monorepo. Convenções universais de TDD em [tdd](tdd.md); testes de unidade de cada ferramenta ficam nas próprias pastas (`webdriver/src/ui/**/*.spec.ts` via Vitest). Convenções específicas do webdriver em [webdriver-tdd](webdriver-tdd.md).

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [e2e-tags](e2e-tags.md) | Tags read/write+domínio, `@manual`, steps em inglês imperativo |
| [e2e-backend](e2e-backend.md) | Banco dedicado, seed determinístico, porta 4200 compartilhada |
| [e2e-setup](e2e-setup.md) | Hidratação do Nuxt, seletores por `data-testid` |

## Organização de arquivo

Um arquivo de spec por domínio, mesmo que fique grande — não dividir os testes do mesmo domínio em vários arquivos só pra deixar menor. `test.describe` + tags já dão a organização interna necessária.
