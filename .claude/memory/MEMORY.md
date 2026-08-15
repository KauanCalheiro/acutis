# Memory Catalog

Instruções persistentes ficam em `./.claude/memory/`. Antes de qualquer ação em um domínio, ler o arquivo correspondente — as regras vivem lá, não aqui. `backend.md`, `frontend.md`, `webdriver.md`, `e2e.md`, `execution.md` e `structure.md` são **índices**: levam às sub-memórias específicas (ler o índice primeiro).

| Arquivo | Tipo | Ler quando |
|---------|------|------------|
| [backend.md](backend.md) | índice | mexer na API: endpoint, controller, service, DTO, recurso (→ module, contracts, filters, persistence, conventions, tdd) |
| [frontend.md](frontend.md) | índice | criar/editar componente, página, tela, formulário (→ naming, props, style, labels, responsive, table, crud, api, icons) |
| [webdriver.md](webdriver.md) | índice | mexer no gravador/runner/vídeo (`backend/src/webdriver`) ou na pill/UI injetável (→ tdd) |
| [e2e.md](e2e.md) | índice | criar/editar teste cross-tool em `e2e/` (Playwright, frontend + backend reais) (→ tags, backend, setup) |
| [execution.md](execution.md) | índice | subir serviço, rodar comando de dev/teste — escolher modo de execução (→ docker, local) |
| [environments.md](environments.md) | reference | mexer em variável, segredo ou sessão do projeto testado — `environments/*.json` versionado, `.env` como cofre |
| [commit.md](commit.md) | feedback | fazer git commit/branch/PR/merge — só quando pedido explicitamente, nunca na main, squash merge com descrição detalhada |
| [specs.md](specs.md) | feedback | escrever spec de brainstorming — vai em `docs/superpowers/`, nunca commitada |
| [dashes.md](dashes.md) | feedback | escrever qualquer texto (código, memória, commit, resposta) — nunca `" - "` entre espaços |
| [comments.md](comments.md) | feedback | escrever/revisar qualquer código — comentário só descreve o que a função faz, nunca a deliberação |
| [branches.md](branches.md) | feedback | depois de mergear PR, ou ao pedir limpeza — apagar branch órfã local/remota |
| [tdd.md](tdd.md) | feedback | qualquer feature/bugfix — red/green/refactor, teste antes do código |
| [trace.md](trace.md) | feedback | antes de editar qualquer arquivo — traçar o fluxo real até ele, nunca escolher por achismo |
| [structure.md](structure.md) | índice | procurar onde fica arquivo/pasta no monorepo (→ backend, frontend, e2e) |
