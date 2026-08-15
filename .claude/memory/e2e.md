---
name: e2e
description: Índice de E2E (Playwright, pasta e2e/) — LER 1º ao criar/editar/rodar teste cross-tool; índice → tags, running, backend, setup
metadata:
  type: feedback
---

Testes cross-tool (frontend + backend reais, com gravador e runner) vivem em `e2e/` na raiz do monorepo. Convenções universais de TDD em [tdd](tdd.md); testes de unidade de cada ferramenta ficam nas próprias pastas (`backend/src/**/__tests__/*.spec.ts` via Vitest). Convenções específicas do webdriver em [webdriver-tdd](webdriver-tdd.md).

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [e2e-running-permission](e2e-running-permission.md) | Rodar sempre o teste mexido; a suíte inteira só quando o usuário pedir |
| [e2e-tags](e2e-tags.md) | Tags read/write+domínio, `@manual`, steps em inglês imperativo |
| [e2e-running](e2e-running.md) | Rodar por domínio, o build do `pretest`, conflito de porta com a stack local |
| [e2e-backend](e2e-backend.md) | Cópia dos projetos de fixture, raiz isolada, um processo só na porta do E2E |
| [e2e-setup](e2e-setup.md) | Hidratação do Nuxt, seletores por `data-testid` |

## Organização de arquivo

Um arquivo de spec por domínio, mesmo que fique grande — não dividir os testes do mesmo domínio em vários arquivos só pra deixar menor. `test.describe` + tags já dão a organização interna necessária.
