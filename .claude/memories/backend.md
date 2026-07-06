---
name: backend
description: Backend Laravel — LER 1º ao criar/editar API, controller, model, migration, recurso; índice → model, contracts, action, filters, conventions, tdd
metadata:
  type: feedback
---

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [backend-model](backend-model.md) | Schema, migration, Model + Factory (PHP attributes) |
| [backend-contracts](backend-contracts.md) | Entrada (`{Resource}Data`) e Saída (`{Resource}Resource`) |
| [backend-action](backend-action.md) | Action (lógica de negócio), Controller, Rota |
| [backend-filters](backend-filters.md) | QueryBuilder, filtros, paginação JSON API |
| [backend-conventions](backend-conventions.md) | Pint, wrapping, estrutura de pastas, restrições |
| [backend-tdd](backend-tdd.md) | Ciclo TDD — teste antes da implementação |

---

## Fluxo de dados

```
HTTP Request
    ↓
Route (routes/api/v1.php)
    ↓
Controller (V1/{Resource}Controller)
    ↓                    ↓
{Resource}Data        Model ←→ DB (schema.dbml → migration)
(entrada)                ↓
                  {Resource}Resource
                  (saída)
    ↓
HTTP Response
```

---

## Ordem de criação dos artefatos

TDD obriga o teste primeiro. Dependências técnicas ditam o resto:

1. **Teste** — cobre o contrato HTTP de ponta a ponta (red) → [backend-tdd](backend-tdd.md)
2. **Migration + Model + Factory** — derivados do [schema](schema.md) → [backend-model](backend-model.md)
3. **Data / Resource** — contrato de entrada e saída → [backend-contracts](backend-contracts.md)
4. **Action + Controller + Rota** — orquestra entrada → model → saída (atenção ao gotcha PT-BR) → [backend-action](backend-action.md)
5. **Pint + commits** — [backend-conventions](backend-conventions.md) + [commit](commit.md)
