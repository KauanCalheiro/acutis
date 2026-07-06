# CLAUDE.md — Protocolos

## Memory Catalog

Instruções persistentes ficam em `./.claude/memories/`. Antes de qualquer ação em um domínio, ler o arquivo correspondente — as regras vivem lá, não aqui. `backend.md`, `frontend.md`, `webdriver.md`, `e2e.md` e `structure.md` são **índices**: levam às sub-memórias específicas (ler o índice primeiro).

| Arquivo | Tipo | Ler quando |
|---------|------|------------|
| [backend.md](.claude/memories/backend.md) | índice | mexer em API, controller, model, migration, recurso (→ model, contracts, action, filters, conventions, tdd) |
| [frontend.md](.claude/memories/frontend.md) | índice | criar/editar componente, página, tela, formulário (→ naming, props, style, labels, responsive, table, crud, api, icons) |
| [webdriver.md](.claude/memories/webdriver.md) | índice | mexer no serviço webdriver (gateway/recorder/video NestJS, ou a pill/UI injetável) (→ tdd) |
| [e2e.md](.claude/memories/e2e.md) | índice | criar/editar teste cross-tool em `e2e/` (Playwright frontend+webdriver+backend) (→ tags, backend, setup) |
| [docker.md](.claude/memories/docker.md) | feedback | subir serviço, rodar comando de dev/teste — tudo via docker compose, nunca no host |
| [schema.md](.claude/memories/schema.md) | reference | antes de migration/model/recurso — fonte de verdade das tabelas (DBML) |
| [commit.md](.claude/memories/commit.md) | feedback | fazer git commit/branch/PR/merge — nunca na main, branch por feature, squash merge com descrição detalhada |
| [comments.md](.claude/memories/comments.md) | feedback | escrever/revisar qualquer código — nunca comentar, renomear em vez de comentar |
| [branches.md](.claude/memories/branches.md) | feedback | depois de mergear PR, ou ao pedir limpeza — apagar branch órfã local/remota |
| [tdd.md](.claude/memories/tdd.md) | feedback | qualquer feature/bugfix — red/green/refactor, teste antes do código |
| [structure.md](.claude/memories/structure.md) | índice | procurar onde fica arquivo/pasta no monorepo (→ backend, frontend, webdriver, e2e) |
