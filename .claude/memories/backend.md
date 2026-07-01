---
name: backend
description: Backend Laravel — LER 1º ao criar/editar API, controller, model, migration, recurso; índice → patterns, filters, conventions, tdd
metadata:
  type: feedback
---

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [[backend-patterns]] | Padrões por camada: Schema, Entrada, Persistência, Saída, Controller, Rota |
| [[backend-filters]] | QueryBuilder, filtros, paginação JSON API |
| [[backend-conventions]] | Pint, wrapping, estrutura de pastas, restrições |
| [[tdd-backend]] | Ciclo TDD — teste antes da implementação |

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

1. **Teste** — cobre o contrato HTTP de ponta a ponta (red) → [[tdd-backend]]
2. **Migration** — derivada do [[schema]] → [[backend-patterns]]
3. **Model + Factory** — persistência + dados de teste → [[backend-patterns]]
4. **Data** — contrato de entrada → [[backend-patterns]]
5. **Resource** — contrato de saída → [[backend-patterns]]
6. **Controller** — orquestra entrada → model → saída → [[backend-patterns]]
7. **Rota** — expõe o controller (atenção ao gotcha PT-BR) → [[backend-patterns]]
8. **Pint + commits** — [[backend-conventions]] + [[commit]]
