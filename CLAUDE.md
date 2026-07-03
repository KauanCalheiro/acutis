# CLAUDE.md — Protocolos

## Memory Catalog

Instruções persistentes ficam em `./.claude/memories/`. Antes de qualquer ação em um domínio, ler o arquivo correspondente — as regras vivem lá, não aqui. `backend.md`, `frontend.md`, `webdriver.md` e `e2e.md` são **índices**: levam às sub-memórias específicas (ler o índice primeiro).

| Arquivo | Tipo | Ler quando |
|---------|------|------------|
| [backend.md](.claude/memories/backend.md) | índice | mexer em API, controller, model, migration, recurso (→ patterns, filters, conventions, tdd) |
| [frontend.md](.claude/memories/frontend.md) | índice | criar/editar componente, página, tela, formulário (→ props, style, table, icons, tdd) |
| [webdriver.md](.claude/memories/webdriver.md) | índice | mexer no serviço webdriver (gateway/recorder/video NestJS, ou a pill/UI injetável) (→ tdd) |
| [schema.md](.claude/memories/schema.md) | reference | antes de migration/model/recurso — fonte de verdade das tabelas (DBML) |
| [commit.md](.claude/memories/commit.md) | feedback | fazer git commit/branch/PR/merge — nunca na main, branch por feature, squash merge com descrição detalhada |
| [comments.md](.claude/memories/comments.md) | feedback | escrever/revisar qualquer código — nunca comentar, renomear em vez de comentar |
| [branches.md](.claude/memories/branches.md) | feedback | depois de mergear PR, ou ao pedir limpeza — apagar branch órfã local/remota |
| [tdd.md](.claude/memories/tdd.md) | feedback | qualquer feature/bugfix — red/green/refactor, teste antes do código |
| [structure.md](.claude/memories/structure.md) | project | procurar onde fica arquivo/pasta no monorepo |


