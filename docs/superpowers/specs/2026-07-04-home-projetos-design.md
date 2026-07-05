# Home de projetos — busca, cards e paginação

Data: 2026-07-04

## Objetivo

Substituir a home starter do Nuxt pela primeira tela real: listagem dos projetos com busca server-side, grid de cards e paginação, conforme mockup (busca no topo + botão "Adicionar +", título "Acesse seus projetos", grid 3 colunas, paginação numerada embaixo).

## Contexto

- Backend pronto: `GET /api/v1/projects` aceita `search`, `page[number]`, `page[size]` e retorna `ProjectResource` paginado (`name`, `slug`, `path`, `repository`, `provider`, `created_at`) com `meta` do Laravel.
- Frontend ainda não tem proxy Nitro `server/api/` nem setup de testes — ambos nascem aqui.

## Escopo

### Proxy Nitro

`frontend/server/api/projects.get.ts`: repassa `search`, `page[number]`, `page[size]` para `GET <backend>/api/v1/projects` e devolve a resposta como veio (data + meta). URL do backend em `runtimeConfig` (nova chave `apiUrl`, server-side, ligada ao `.env` raiz).

### Página `app/pages/index.vue`

- Busca (`UInput`) com debounce ~300 ms, param `search`, reset pra página 1 ao digitar. `data-testid="projeto-busca"`.
- Botão "Adicionar +" visual, `disabled`. `data-testid="projeto-adicionar"`.
- Título "Acesse seus projetos".
- Grid responsivo 1→3 colunas de `project/card`. Sem clique no card.
- `UPagination` dirigida por `meta.total`/`per_page`. Page size fixo 6. `data-testid="projeto-paginacao"`.
- Estados: skeleton durante loading, mensagem de vazio quando a busca não retorna nada.
- Marcador de hidratação `data-hydrated` (convenção e2e-setup).

### Componente `app/components/project/card.vue`

Card com nome, path/repositório e badge do provider com ícone (GitHub via `i-simple-icons-github`; provider desconhecido/nulo → badge omitida). Props via interface nomeada, destructure + default (convenção frontend-props).

### Testes — Nuxt (@nuxt/test-utils + Vitest)

Bootstrap: `@nuxt/test-utils`, `vitest`, `happy-dom` como devDependencies do frontend, `vitest.config.ts` com `defineVitestConfig`, script `test` no `package.json`.

- `project/card.spec.ts` (mountSuspended): renderiza nome, path e badge do provider; omite badge sem provider.
- `pages/index.spec.ts` (mountSuspended + registerEndpoint): renderiza cards da resposta mockada; estado vazio quando `data: []`.

Escritos antes da implementação (TDD red/green/refactor).

### Teste E2E — `e2e/tests/home.spec.ts`

`test.describe` com tags `['@read', '@project']`. Projetos vêm do filesystem (dirs com `acutis.json` em `ACUTIS_PROJECTS_PATH`), não de DB — o seed é um diretório de fixtures: `e2e/fixtures/projects/` com 8 dirs de projeto (cada um só com `acutis.json`; sem git remote → provider nulo, badge coberta no teste de componente). O backend da rodada E2E sobe com `ACUTIS_PROJECTS_PATH` apontando pra esse diretório. Seletores só por `getByTestId`, espera de hidratação antes de interagir.

Cenários:
1. Home lista os cards da primeira página (6 itens).
2. Buscar filtra os cards (server-side) e reseta pra página 1.
3. Navegar pra página 2 troca os cards.
4. Busca sem resultado mostra o estado vazio.

## Fora do escopo

- Ação do botão "Adicionar +" (criar projeto template/clone) — feature futura.
- Página de detalhe do projeto e clique no card.
- Ordenação e filtros além da busca.

## Decisões

- Proxy Nitro em vez de chamar o backend direto do browser: convenção do repo (frontend-api), evita CORS e esconde a URL do backend.
- Page size fixo 6 (2 linhas × 3 colunas do mockup) — sem seletor de tamanho.
- Busca server-side (param `search` já existente) — sem filtro client-side.
