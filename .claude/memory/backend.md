---
name: backend
description: API Nitro na raiz — handlers, composição, casos de uso, contratos e persistência
metadata:
  type: feedback
---

A API usa a mesma origem da interface. O fluxo é:

```
server/api ou server/routes
  → server/utils/composition
  → core/use-cases
  → core/modules
  → providers
```

Entradas e respostas são validadas pelos schemas Zod de `shared/contracts`. Os handlers ficam
magros e dependem da composição, nunca diretamente de services concretos ou providers.

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [backend-persistence](backend-persistence.md) | Filesystem, Git e SQLite das configurações |
| [backend-conventions](backend-conventions.md) | Estilo TS, erros em pt-BR, config e restrições |
| [backend-tdd](backend-tdd.md) | Ciclo TDD com Vitest e harness H3 |
