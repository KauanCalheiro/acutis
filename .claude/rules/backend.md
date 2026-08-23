---
paths:
  - "server/**"
  - "core/modules/**"
  - "core/use-cases/**"
  - "core/common/**"
  - "core/config/**"
  - "shared/**"
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
