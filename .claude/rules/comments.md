**Aceitável:** uma linha dizendo **o que** a função/classe faz.

**Proibido:** comentário em tom de conversa — narrar a decisão que foi tomada, o trade-off avaliado, o que aconteceria se fosse diferente, para quem serve, o motivo histórico. Nada de aparte com travessão justificando a escolha.

```ts
/** Uma linha do .env; null quando não é CHAVE=valor. */          // ✅

/**                                                                // ❌
 * O .env cru é o piso, não a verdade: quando o acutis manda o
 * ambiente já resolvido, é ele que vale — é dele que vêm os
 * valores do ambiente ativo.
 */
```

**Why:** deliberação envelhece e ninguém atualiza junto com o código — vira mentira dentro do arquivo. E trecho que só se entende com narrativa está com o nome errado; renomear resolve a causa, comentar maquia o sintoma.

**How to apply:**

- Comentário explicando **uma decisão** → apagar. Se a decisão precisa sobreviver, vira memória curta em `.claude/rules/`, não linha de código.
- Comentário explicando **o que o trecho faz** passo a passo → renomear variável/função/arquivo até o código falar sozinho.
- Comentário de **uma linha, descritivo, sobre a responsabilidade** da função ou classe → pode ficar.
- `@param`, `@return`, `@ts-expect-error`, `@vitest-environment` e diretivas de compilador não contam como comentário — mas não pendurar texto explicativo depois delas.
