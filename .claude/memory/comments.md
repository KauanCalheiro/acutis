---
name: comments
description: Nunca comentar código — comentário é sintoma de nome ruim; renomear variável/função em vez de comentar
metadata:
  type: feedback
---

Nunca adicionar comentários no código — nem para explicar o "porquê", sem exceção.

**Why:** se uma variável, função ou trecho precisa de comentário pra ser entendido, o nome está errado. Renomear resolve a causa; comentar só maquia o sintoma.

**How to apply:** ao escrever ou revisar qualquer código do projeto (backend, frontend, webdriver), se sentir vontade de explicar algo com `//` ou docblock, pare e renomeie a variável/função/arquivo até o código falar sozinho. `@ts-expect-error` e diretivas de compilador não contam como comentário — mas não adicionar texto explicativo depois deles.
