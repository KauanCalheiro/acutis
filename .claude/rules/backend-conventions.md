---
paths:
  - "server/**"
  - "core/modules/**"
  - "core/use-cases/**"
  - "core/common/**"
  - "core/config/**"
  - "shared/**"
---

Convenções para mudanças em `server/`, `core/` e `shared/contracts/`. Ver [backend](backend.md).

## Estilo

- 4 espaços, sem ponto e vírgula no fim da linha, aspas simples.
- **Import relativo sempre com `.js`** (`'./project.service.js'`) — é ESM de verdade, sem o sufixo o Node não resolve.
- `type` explícito no import de tipo (`import type { ... }`).
- Conferir com `pnpm typecheck` (e `pnpm typecheck:ui` quando mexer na pill) antes de dar a mudança por pronta.

## Erros

Erro de domínio é uma classe de `common/exceptions/errors.ts` — `NotFound`, `BadRequest`, `ValidationFailed` —, lançada pelo service. O `HttpErrorFilter` global traduz em resposta; o 422 leva `{ message, errors }`. Nunca montar `res.status(...).json(...)` à mão no controller.

**Toda mensagem de erro em pt-BR**, inclusive as dos decorators de validação.

Erro vindo de fora (provedor de IA, processo externo) **nunca sobe cru** — vira `ProviderFailed` ou
outro `HttpError` com mensagem que diz o que fazer. A tradução mora onde todos os chamadores passam:
para os agentes é o `runAgent` (`ai/providers/provider-errors.ts`), não cada agente. Ver
[ai-claude-agent](ai-claude-agent.md).

## Respostas

- O tipo de retorno do controller é o do `dto/responses/` — ver [backend-contracts](backend-contracts.md).
- Sem wrapper `data`, exceto a paginação (`{ data, meta }`).
- `store` responde 201; `destroy`, 204 (`@HttpCode(204)`); POST que não cria recurso, 200 (`@HttpCode(200)`).

## Config

- Variável de ambiente é lida **uma vez**, em `src/config/env.ts`, e exportada como constante (`PORT`, `CORS_ORIGIN`, `RECORDER_HEADLESS`). Nada de `process.env` espalhado pelos módulos.
- A raiz de projetos é a exceção deliberada: sai de `common/utils/acutis.ts`, que relê a variável a cada chamada porque o teste a troca por execução.

## Estrutura de pastas

```
src/config/            ← env, caminhos e as opções do banco
src/common/            ← filters, pipes, interceptors, exceptions, utils, playwright, types
src/controllers/       ← adaptadores HTTP, subdivididos por domínio
src/use-cases/         ← operações da aplicação, subdivididas por domínio
src/dto/               ← validação HTTP e responses, subdivididos por domínio
src/migrations/        ← as migrations do TypeORM → [backend-persistence](backend-persistence.md)
src/modules/{dominio}/ ← composição Nest, services, entities, providers e testes
src/scripts/           ← comandos de desenvolvimento (`pnpm db:fresh`)
src/webdriver/         ← gravador, runner, vídeo e pill → [webdriver](webdriver.md)
test/support/          ← harness e fixtures dos testes
```

Não criar pasta base nova sem aprovação. Nunca comentar deliberação — ver [comments](comments.md).
