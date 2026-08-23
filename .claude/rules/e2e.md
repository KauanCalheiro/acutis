---
paths:
  - "e2e/**"
---

Testes cross-tool contra a aplicação Nitro real, com gravador e runner, vivem em `e2e/`. Convenções universais de TDD em [tdd](tdd.md); os testes unitários ficam em `core/**/__tests__` e `tests/`. Convenções específicas do webdriver em [webdriver-tdd](webdriver-tdd.md).

## Organização de arquivo

Um arquivo de spec por domínio, mesmo que fique grande — não dividir os testes do mesmo domínio em vários arquivos só pra deixar menor. `test.describe` + tags já dão a organização interna necessária.
