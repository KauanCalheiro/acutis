# Auditoria de código — acutis

Rodada sobre os 410 arquivos versionados (~22k linhas de código próprio: backend 15k, frontend 6,7k, e2e 3,5k).

---

# Critérios de avaliação

Dez critérios, cada um com peso e uma régua objetiva. A nota final é a média ponderada.

| # | Critério | O que mede | Peso |
|---|---|---|---|
| 1 | Arquitetura e fronteiras | Cada módulo dono do seu domínio; nada de produção dependendo de artefato de teste | 15 |
| 2 | Duplicação / fonte única | Contratos, tipos e handlers existem em um lugar só | 15 |
| 3 | Consistência | O que as convenções escritas mandam vs. o que o código faz | 12 |
| 4 | Simplicidade | Abstração proporcional ao problema; nada de camada por camada | 12 |
| 5 | Código morto e resíduo | Arquivo, flag e doc que não servem mais a ninguém | 10 |
| 6 | Tipagem e contratos | Rigor do TS e alinhamento back↔front | 10 |
| 7 | Testes | Cobertura e distribuição na pirâmide | 10 |
| 8 | CI e automação | O que roda sozinho antes de mergear | 8 |
| 9 | Configuração e ambiente | Config previsível, sem valor repetido nem modo mágico | 5 |
| 10 | Documentação | Comentário e doc que descrevem o estado real | 3 |

---

# Nota por critério

## 1. Arquitetura e fronteiras — **8,0**

Estrutura muito boa: `modules/<domínio>/{controller,service,dto,providers,entities}`, webdriver isolado, `common/` sem lixo. Três furos concretos:

- **`ai/providers/stub.ts` é dependência de produção.** `auth.service.ts:5` importa `aiConfigured, fixedAuthSetup, writeGherkin` do *stub*. O fluxo de autenticação nunca chama modelo de verdade — ele grava o Gherkin fixo `'Funcionalidade: Login do Usuário\n  Cenário: entra'` e o `AUTH_FIX` hard-coded. A geração de cenário (`generation.service.ts`) usa os agentes reais (`ai/agents/gherkin.js`) com gate `settings.canUseAi()`. **Dois caminhos de IA paralelos, um deles é um dublê.**
- **Dois oráculos de "a IA está ligada?".** `stub.aiConfigured()` lê `ACUTIS_AI_PROVIDER` com default `'stub'` — ou seja, sempre retorna `true`. `SettingsService.canUseAi()` consulta o banco. Auth usa o primeiro, o resto usa o segundo.
- **`authCredentials` mora em `project.controller.ts`** consumindo `AuthCredentialsDto` de `modules/auth/dto/` — com `auth.controller.ts` existindo ao lado.

## 2. Duplicação / fonte única — **6,0**

O item mais caro do relatório.

- ~~**30 arquivos de proxy em `frontend/server/api/`**, ~230 linhas, todos com o mesmo corpo de 5 a 10 linhas~~ — **resolvido**, mas não como proposto aqui. Um `[...path].ts` único **não** serve: a chave gerada vira `/api/projects/**`, e o matcher de tipos do Nuxt casa `:param` com `${string}` mas não sabe casar `**` — o `typecheck` reprova 6 call sites com `Type '"PUT"' is not assignable to type '"POST" | "post"'`. Em Nitro **o arquivo por rota é o contrato de tipo**; o que estava duplicado era o corpo. Ele virou `server/utils/proxy.ts`, e cada rota 1:1 é hoje uma linha: `export default defineEventHandler(proxy)`. 230 → 67 linhas, com o autocomplete de rota intacto (as 23 chaves de `nitro-routes.d.ts` saem idênticas).
- **O contrato da API está tipado duas vezes à mão** e já derivou: `backend/.../scenario.response.ts` diz `events: unknown` e `status: string`; `frontend/app/types/project.ts` diz `events: RecorderEvent[]` e `status: 'waiting'|'success'|'failed'`. Nada garante que continuem iguais — são três lockfiles independentes, sem workspace pnpm no monorepo.
- **`SelectorSuggestion` definido 3×** (`ai/providers/stub.ts:16`, `rules/selector-rules.ts:4`, `frontend/app/types/project.ts`). **`FixedSpec` 2×** (`stub.ts:10` e `agents/spec-fixer.ts:14`). **`RunStep` 3×** com uniões de status diferentes (`scenario.response.ts`, `types/project.ts` como `ScenarioRunStep`, `composables/run-stream.ts`).
- **`writeGherkin` é o nome de duas funções diferentes** — a do stub (síncrona, 1 arg) e a do agente (async, 2 args). Import trocado compila mudo até o runtime.

## 3. Consistência — **6,0**

- **A convenção `dto/responses/` é seguida por 2 de 9 módulos.** `backend-contracts.md` manda "um tipo por recurso em `dto/responses/`, nunca objeto interno cru". Só `project` e `scenario` têm a pasta. Settings devolve `AiSettings` de `entities/`, generation devolve `TestDraft` do próprio service, auth devolve `GeneratedAuthSetup` do service, git devolve `{ public: boolean }` inline, recorder devolve `{ ok: true }` inline.
- **Nenhum linter no backend nem no e2e.** Só o frontend tem `eslint.config.mjs` (herdado do módulo Nuxt). Resultado visível: vírgula final é proibida no frontend (`commaDangle: 'never'`) e aparece livremente no backend (`runner.service.ts:105,110`).
- Indentação é coerente por pacote (backend 4, frontend 2, e2e 4) com dois desgarrados: `project-show.spec.ts` e um arquivo do e2e.

## 4. Simplicidade — **7,0**

Em geral enxuto, e os atalhos deliberados estão marcados — 13 comentários `ponytail:` explicando teto e caminho de upgrade. Isso é raro e conta a favor. Excessos reais:

- **`runAgent` monta um `StateGraph` do LangGraph de um nó só** (`ai/providers/agent.ts:47-65`) para chamar `ask()` e relançar o erro. É a única ocorrência de `@langchain/langgraph` no repo inteiro. Um `try/catch` de 5 linhas faz o mesmo e some com a dependência.
- **`request-log.interceptor.ts`, 315 linhas**, reimplementa logging estruturado: monkey-patch do `fetch` global, rotação por dia, retenção de 7 dias, redação de segredos e remontagem de NDJSON/SSE. É útil e testado (229 linhas de spec), mas é `pino` + `pino-roll` em ~40 linhas. Também escreve com `appendFileSync` no `response.on('finish')` — I/O síncrono no caminho da requisição.
- As classes finas `Url` e `Playwright` **não** são excesso: 7 a 9 chamadas cada, ganham o lugar.

## 5. Código morto e resíduo — **5,0**

- **`frontend/server/routes/_ws.ts` está morto.** O relay WebSocket do Nitro não recebe ninguém: `composables/webdriver.ts:101` conecta em `${public.webdriver.acutis.url}/ws`, que é o backend `:4000`. Junto morre `nitro.experimental.websocket: true` no `nuxt.config.ts`.
- **`frontend/server/routes/recording/*.ts` (3 arquivos, 38 linhas) idem** — o vídeo é servido pelo backend (`review/modal.vue:147` monta `${url}/recording/...` com a URL do backend). O `.tmp/recordings` do Nitro nunca é escrito.
- **Resíduo do template Nuxt**: `frontend/README.md` ainda é "Nuxt Starter Template", `frontend/LICENSE` é "Copyright (c) 2025 Nuxt UI Templates", `frontend/renovate.json` aponta para `github>nuxt/renovate-config-nuxt`.
- **`WEBDRIVER_TEST_MODE=1` é uma trava que todo caminho de execução destrava.** `dev.sh:103`, `docker-compose.dev.yml:28`, o `bin` empacotado e o e2e setam sempre. Está documentada em 4 lugares como "não é opcional". Uma guarda que ninguém pode deixar fechada não é guarda.
- **`COMPARATIVO-TCC.md` descreve um backend Laravel que não existe mais** — cita `ListProjects.php:31`, `PersistScenarioRun.php:49`, `CloneProjectFromGit`.
- **5 páginas `pages/dev/` (504 linhas) vão no bundle de produção sem guarda.** Não há `routeRules`, `middleware` nem check de `import.meta.dev`. Duas delas referenciam `.claude/memory/feedback_dev-preview-routes.md`, que não existe.

## 6. Tipagem e contratos — **8,0**

O ponto mais forte do repositório em rigor bruto: **zero `any`, zero `as any`, zero `@ts-ignore`/`@ts-expect-error`, zero `eslint-disable` em 22 mil linhas.** `strict: true`, `NodeNext`, DTOs com `class-validator` e mensagem pt-BR à mão. Descontos:

- `backend/tsconfig.json` **exclui `src/**/__tests__`** — 43 arquivos de teste nunca passam pelo `tsc`.
- `e2e/` não tem `tsconfig.json` nenhum; o `typecheck` do CI (que não roda, ver #8) também não o cobriria.
- O contrato back↔front não é verificado por tipo (ver #2).

## 7. Testes — **7,0**

Volume bom e bem distribuído no backend: **477 asserções em 43 specs**, colocados em `__tests__/` ao lado do código. E2E robusto: **152 testes em 10 arquivos**, com fixtures de projeto de verdade e suporte próprio (`e2e/support/`).

- **O frontend tem 4 testes unitários para 53 componentes e páginas.** A regra do projeto (`tdd-frontend.md`) diz que o nível é E2E full-stack, o que é uma escolha legítima — mas as 614 linhas de `scenarios/[...scenario].vue` e as 375 de `settings/modal.vue` carregam lógica que E2E cobre caro e devagar.
- `native-recording-poc.spec.ts` é uma PoC dentro da suíte que roda a cada execução.

## 8. CI e automação — **2,0**

**O único workflow do repositório está em `frontend/.github/workflows/ci.yml`.** O GitHub Actions só lê `.github/workflows/` na raiz — **esse arquivo nunca executou.** É outro resto do template Nuxt.

E mesmo se fosse movido, ele roda só `eslint .` e `nuxt typecheck` do frontend: não roda o `vitest` do backend (477 asserções), não roda o `vitest` do frontend (4 testes), não roda os 152 testes e2e, não roda `tsc --noEmit` do backend.

Na prática: **nada é verificado automaticamente antes de um merge.**

## 9. Configuração e ambiente — **7,0**

`docker-compose.dev.yml` + overlay `linux` + `dev.sh` formam um conjunto coerente, com portas documentadas (23000/24000 no Docker, 3000/4000 local) e checagem de porta ocupada antes de subir. Descontos:

- `runtimeConfig` declara o mesmo endereço duas vezes (`api.acutis.url` e `public.webdriver.acutis.url`, ambos `http://localhost:4000`); só o público é necessário.
- Três `pnpm-lock.yaml` independentes e nenhum workspace na raiz — é a causa estrutural da duplicação de tipos do #2.
- `@nestjs/common|core|platform-*` em `^10`, mas `@nestjs/typeorm` em `^11` e `@nestjs/testing` em `^11`. Major desalinhado entre runtime e teste.

## 10. Documentação — **9,0**

O melhor critério. `docs/` com índice (`RUN.md` → LOCAL/DOCKER/DEPLOY/TESTS), `.claude/memory/` com catálogo e sub-memórias por domínio, comentários em pt-BR que descrevem o *que* a função faz sem narrar deliberação, e os `ponytail:` documentando cada atalho com seu teto. Desconto pelo `COMPARATIVO-TCC.md` obsoleto e pela referência de memória quebrada.

---

# Nota final

| Critério | Nota | Peso | Ponderado |
|---|---|---|---|
| Arquitetura e fronteiras | 8,0 | 15 | 120 |
| Duplicação / fonte única | 6,0 | 15 | 90 |
| Consistência | 6,0 | 12 | 72 |
| Simplicidade | 7,0 | 12 | 84 |
| Código morto e resíduo | 5,0 | 10 | 50 |
| Tipagem e contratos | 8,0 | 10 | 80 |
| Testes | 7,0 | 10 | 70 |
| CI e automação | 2,0 | 8 | 16 |
| Configuração e ambiente | 7,0 | 5 | 35 |
| Documentação | 9,0 | 3 | 27 |
| **Total** | | **100** | **644** |

# **6,4 / 10**

Um código com engenharia acima da média — tipagem sem escapatória, comentários honestos, testes de backend sólidos — puxado para baixo por três coisas que não são qualidade de código e sim de projeto: **nada roda em CI, o contrato da API é copiado à mão entre dois pacotes, e o fluxo de autenticação usa um dublê de teste em produção.**

---

# O que melhorar, em ordem de retorno

| # | Ação | Custo | Ganho |
|---|---|---|---|
| 1 | Mover `frontend/.github/workflows/ci.yml` → `.github/workflows/`, e fazer rodar backend `vitest` + `tsc --noEmit` + frontend lint/typecheck + e2e | 1 arquivo | Sai de zero verificação automática |
| 2 | Tirar o `stub.ts` de `auth.service.ts`: usar `agents/gherkin` + `agents/spec-fixer` com gate `settings.canUseAi()`, igual `generation.service.ts` | ~30 linhas | Autenticação passa a usar IA de verdade; some o segundo oráculo |
| 3 | `frontend/server/api/[...path].ts` com `proxyRequest`, mantendo só os 3 handlers de caminho divergente | −27 arquivos, −215 linhas | Fim de 30 cópias do mesmo corpo |
| 4 | `pnpm-workspace.yaml` na raiz + pacote `shared/contracts` importado pelos dois lados | ~1 dia | Uma fonte de verdade; acaba a deriva `auth_status`/`events`/`RunStep` |
| 5 | Apagar `frontend/server/routes/_ws.ts`, `routes/recording/*`, `nitro.experimental.websocket`, `frontend/README.md`, `frontend/LICENSE`, `frontend/renovate.json`, `COMPARATIVO-TCC.md` | −7 arquivos, ~130 linhas | Zero resíduo de template e de arquitetura antiga |
| 6 | Trocar o `StateGraph` de um nó por `try/catch`; remover `@langchain/langgraph` | −25 linhas, −1 dep | |
| 7 | Decidir o `WEBDRIVER_TEST_MODE`: ou vira guarda real (`NODE_ENV !== 'production'`) ou some, com os 4 blocos de doc | −12 linhas | Acaba a flag-teatro |
| 8 | `routeRules: { '/dev/**': { prerender: false } }` + guarda `import.meta.dev` nas 5 páginas `pages/dev/` | ~10 linhas | 504 linhas fora da produção |
| 9 | ESLint no backend e no e2e; tirar `__tests__` do `exclude` do `tsconfig`; criar `e2e/tsconfig.json` | ~3 arquivos | Convenção deixa de ser combinada e passa a ser imposta |
| 10 | Aplicar `dto/responses/` nos 7 módulos que faltam; alinhar `@nestjs/*` no mesmo major | ~7 arquivos | |

Fazendo de 1 a 5, a nota vai para **~8,1**.

`net: -400 linhas, -1 dep, -34 arquivos.`
