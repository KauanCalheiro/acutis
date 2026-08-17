---
name: backend
description: Backend NestJS (backend/src/modules) — LER 1º ao criar/editar endpoint, DTO, service, recurso; índice → module, contracts, filters, persistence, conventions, tdd
metadata:
  type: feedback
---

A API `/api/v1` entra por `backend/src/controllers`, passa por `backend/src/use-cases` e é composta pelos módulos Nest em `backend/src/modules`. O gravador e o runner vivem no mesmo processo, em `backend/src/webdriver`. Estrutura de pastas em [structure-webdriver](structure-webdriver.md).

## Sub-memórias

| Arquivo | Assunto |
|---------|---------|
| [backend-module](backend-module.md) | Anatomia do módulo: controller magro, service com a regra, providers, entities |
| [backend-contracts](backend-contracts.md) | Entrada (`dto/*.dto.ts`, class-validator) e saída (`dto/responses/*.response.ts`) |
| [backend-filters](backend-filters.md) | Listagem: `filter[]`, `search`, `sort`, paginação `page[]` |
| [backend-persistence](backend-persistence.md) | O repositório é o sistema de arquivos; o único banco é o SQLite das configurações |
| [backend-conventions](backend-conventions.md) | Estilo TS, erros em pt-BR, status HTTP, config, restrições |
| [backend-tdd](backend-tdd.md) | Ciclo TDD — Vitest + `startApi`, teste antes da implementação |

---

## Fluxo de dados

```
HTTP Request
    ↓
Controller (controllers/{dominio}/{dominio}.controller.ts)
    ↓                         ↓
{X}Dto                    Use case → Service ←→ providers/ (disco, git, sqlite)
(entrada, validada             ↓
 pelo ValidationPipe)     {X}Response
                          (saída, tipo do dto/responses/)
    ↓
HTTP Response
```

---

## Ordem de criação dos artefatos

TDD obriga o teste primeiro. Dependências técnicas ditam o resto:

1. **Teste** — cobre o contrato HTTP de ponta a ponta (red) → [backend-tdd](backend-tdd.md)
2. **Provider** (ou **migration**, quando a mudança tocar o banco) — a leitura/escrita do estado → [backend-persistence](backend-persistence.md)
3. **DTO / Response** — contrato de entrada e saída → [backend-contracts](backend-contracts.md)
4. **Use case + Service + Controller + Module**: orquestra entrada, regra, provider e saída. Ver [backend-module](backend-module.md).
5. **`pnpm typecheck` + commits** — [backend-conventions](backend-conventions.md) + [commit](commit.md)
