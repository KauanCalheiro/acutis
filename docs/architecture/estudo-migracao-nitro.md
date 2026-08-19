# Estudo de viabilidade: migrar o backend NestJS para o server side do Nuxt (Nitro)

Levantamento feito em 18/08/2026 sobre o estado atual do repositório. Nada foi implementado.

## Veredito

**Viável, e mais barato do que parece** — porque a camada Nitro que receberia o código **já existe e já espelha a API inteira**. A migração não é "reescrever o backend em outro framework": é **apagar um salto de rede**, trocando `ofetch(':4000/api/v1/...')` por `import` direto do caso de uso.

O risco não está na API HTTP. Está em três pontos concretos: **WebSocket do gravador**, **dependências nativas no build do Nitro** e **as 32 suítes que sobem o app pelo container do Nest**.

## O que existe hoje

| Camada | Arquivos | LOC (sem teste) |
|---|---|---|
| `backend/src/modules` (services, providers, entidades) | — | 4.858 |
| `backend/src/webdriver` (gravador, runner, vídeo, pill) | — | 1.630 |
| `backend/src/common` (filtros, pipes, interceptors, eventos) | — | 635 |
| `backend/src/dto` (class-validator) | 16 DTOs | 522 |
| `backend/src/controllers` | 8 controllers / 43 rotas | 373 |
| `backend/src/use-cases` | — | 193 |
| `backend/src/config` + `migrations` + `scripts` | — | 214 |
| **Total produção** | **152 arquivos** | **8.492** |
| Testes do backend | 69 spec | 9.277 |
| `frontend/server` (BFF Nitro) | 36 handlers | ~350 |

Ou seja: **43 rotas Nest e 36 handlers Nitro descrevendo as mesmas operações**, com os mesmos schemas Zod do `@acutis/contracts` validando dos dois lados.

## O que é portável sem esforço (~85% do código)

Praticamente tudo que importa. Services, providers, casos de uso, o módulo de IA (848 LOC, LangChain + SDKs Claude/Codex), git (`simple-git`), filesystem, Playwright, o emissor de spec, o `stream-reporter` — é TypeScript de Node puro. O acoplamento ao Nest nesses arquivos é só o decorador `@Injectable()` e a injeção por construtor; ambos somem trocando por instanciação explícita.

A camada de contratos ajuda muito: os DTOs já implementam schemas do `@acutis/contracts`, então o Nitro valida a entrada com o Zod que já está lá — não é uma reescrita de validação, é remover a duplicata `class-validator`.

## O que dá trabalho de verdade

### 1. Injeção de dependência (o item que mais custa)
9 `@Module`, 27 classes `@Injectable`, 1 provider com token custom (`ProjectWriter` → `FileSystemProjectWriter`). O Nitro não tem container. Substituto: uma raiz de composição por domínio (`server/utils/<domínio>.ts` devolvendo singletons). São ~9 arquivos pequenos.

O custo real não está no código de produção, está nos testes: **32 dos 69 spec sobem o app via `test/support/harness.ts`** (`Test.createTestingModule` + supertest). Desses, 9 pegam providers do container (`api.get<DataSource>`, `api.get<SettingsService>`) e 3 usam `overrideProvider` para trocar o runner por um dublê. Sem container, o dublê vira `vi.mock` ou um setter na raiz de composição.

**A boa notícia:** o `harness` é um ponto único. Reescrevê-lo para subir um app h3/Nitro (`@nuxt/test-utils` com `setupNitro`, ou `toNodeListener` + supertest) mantém a assinatura `api.http` / `api.get` e as 32 suítes seguem quase intactas.

### 2. WebSocket do gravador
`RecorderGateway` usa `@nestjs/platform-ws` com um adaptador custom (`AcutisWsAdapter`) que roteia por `message.type`. O Nitro tem WebSocket via `crossws` — já habilitado (`nitro.experimental.websocket: true`) e já em uso num handler morto (`server/routes/_ws.ts`, relay de uma extensão que não existe mais; candidato a deleção independente desta migração). A tradução é direta: `defineWebSocketHandler` + um `switch` no `type`, ~60 LOC.

Ponto de atenção: o `RecorderService` guarda estado de sessão (navegador Playwright aberto) num singleton. No Nitro isso continua funcionando **em dev e no build Node**, mas amarra o app a um único processo — o que já é verdade hoje.

### 3. Dependências nativas e binários no build do Nitro
`better-sqlite3`, `playwright` e `@openai/codex-sdk` não podem passar pelo rollup do Nitro. Precisam entrar em `nitro.externals.external` / `noExternal` corretamente e continuar resolvíveis a partir do `.output`. Isso é o tipo de coisa que funciona em `nuxt dev` e quebra no `nuxt build` — **precisa ser provado cedo, num spike, antes de qualquer migração em massa**.

Se a prova der trabalho: as 2 tabelas e 2 migrations do SQLite não justificam TypeORM. `node:sqlite` (nativo no Node 22+) mata `typeorm`, `@nestjs/typeorm`, `better-sqlite3` e `reflect-metadata` de uma vez, e reduz o problema ao Playwright.

### 4. Respostas que escapam do JSON
4 endpoints usam `@Res()` do Express: relatório HTML do Playwright (`sendFile` com sub-caminhos), vídeo da sessão, vídeo do run, e o NDJSON/SSE do runner. No h3 viram `sendStream`/`createReadStream` — o `server/routes/recording/[id].get.ts` já faz exatamente isso hoje e serve de modelo. O relatório HTML servido como site estático é o mais chato (precisa de `[...path].get.ts` com guarda de path traversal).

### 5. Testes de arquitetura
`src/architecture/__tests__/boundaries.spec.ts` codifica as fronteiras atuais (controllers só dependem de casos de uso, DTOs implementam contratos, **"não permite proxy genérico nas rotas do Nuxt"**). Metade dessas regras deixa de fazer sentido e a outra metade precisa ser reescrita para a topologia nova. É uma reescrita do arquivo, não um ajuste.

### 6. Empacotamento CLI
Hoje o `bin/acutis.js` sobe **dois processos** (dist/main.js + frontend/server/index.mjs), acha duas portas livres e espera as duas subirem. Depois da migração vira **um** `.output/server/index.mjs`. Isso é ganho, não custo: some o `scripts/bundle-frontend.js`, some a negociação de portas, some o CORS, some o `runtimeConfig.api.acutis.url`.

## Cobertura de teste: o argumento mais forte dos dois lados

- Backend: ~99% de cobertura, piso de 95% no gate.
- `frontend/server`: **zero testes**. O `vitest.config.ts` do frontend cobre só `app/**`. Os 36 handlers Nitro não têm um teste sequer.

Isso corta para os dois lados. **Contra a migração:** mover 8.5k LOC testados para dentro de uma camada cuja cultura de teste hoje é inexistente é como se perde cobertura. **A favor:** hoje existem 36 arquivos de código não testado *só para repassar chamada* — eles somem inteiros na migração.

Condição inegociável se a migração acontecer: o gate de cobertura do frontend passa a incluir `server/**` com o mesmo piso de 95%, **antes** de a primeira rota migrar.

Detalhe operacional: o backend está no Vitest 2 e o frontend no Vitest 4. A unificação é obrigatória e provavelmente pega mocks pelo caminho.

## Ganhos concretos

- Um salto de rede a menos por requisição, e uma serialização/validação a menos (hoje toda resposta é validada com Zod no Nitro *depois* de ter sido validada com class-validator no Nest).
- 36 handlers de repasse deletados; a duplicação `contracts` ↔ DTO some.
- Um processo, uma porta, um build, um `pnpm dev`. Sem CORS, sem `dev.sh` orquestrando dois serviços.
- Saem do `package.json`: `@nestjs/*` (5), `class-validator`, `class-transformer`, `reflect-metadata`, `rxjs`, `@nestjs/platform-express`, `unplugin-swc` (o SWC só está lá por causa do `emitDecoratorMetadata` do Nest — comentado em dois configs).
- Deploy e distribuição npm ficam triviais: `nuxt build` e pronto.

## Perdas concretas

- Fronteiras arquiteturais deixam de ser impostas pelo framework. Módulos, escopo de provider e `exports` viram convenção — e este repo tem ADR (0006) e teste de arquitetura justamente porque essa disciplina importa aqui.
- O roteamento por arquivo do Nitro não expressa bem 43 rotas com sub-recursos; `server/api/projects/[slug]/environments/[environment]/activate.post.ts` já mostra onde isso vai dar.
- Nest é argumento de TCC ("backend em NestJS com camadas explícitas"). Nitro handler + função é mais simples de defender tecnicamente e mais difícil de vender como arquitetura.
- Um processo só significa que o gravador Playwright e o SSR do Nuxt compartilham event loop. Uma sessão de gravação travada leva a UI junto.

## Caminho recomendado (se for pra fazer)

O ponto que torna isso seguro: **cada rota pode migrar sozinha**. O handler Nitro já existe; migrar significa trocar a linha `await acutis('/api/v1/...')` por uma chamada direta ao caso de uso. O Nest continua de pé servindo o que ainda não migrou, e o frontend não percebe nada.

1. **Spike (1 dia, obrigatório antes de decidir):** provar que `nuxt build` + `.output` roda Playwright, SQLite e o SDK do Codex. Se falhar, o estudo para aqui.
2. **Cobertura primeiro:** incluir `server/**` no gate do frontend e unificar o Vitest. Migrar código testado para dentro de uma zona sem gate é como isso vira dívida.
3. **Portar o `harness`** para subir um app Nitro mantendo `api.http`/`api.get`. É o que preserva as 32 suítes.
4. **Migrar por domínio, do mais simples ao mais acoplado:** `environment` → `project` → `scenario` → `git` → `settings` (SQLite) → `auth` → `ai` → `generation`. Um domínio por PR, com a suíte E2E como rede.
5. **Webdriver por último** (gravador, WS, runner, vídeo) — é o único bloco com risco de verdade.
6. **Deletar o Nest** quando o `ApiModule` estiver vazio: `app.module.ts`, `main.ts`, o adaptador WS, pipes/filtros/interceptors e as 5 dependências.

Ordem de grandeza: ~1.800 LOC de produção a reescrever de fato (controllers + DTOs + common + wiring + gateway), o resto é mover arquivo e trocar import. O grosso do esforço é a etapa 3.

## Quando *não* fazer

Se o TCC precisa ser defendido em prazo curto, não faça. A migração não entrega nenhuma funcionalidade nova, mexe em 100% dos caminhos de request e coloca em risco os ~99% de cobertura que hoje são um dos pontos fortes do trabalho. O ganho é de manutenção e de empacotamento — real, mas colhido *depois* da entrega.

Meio-termo que captura metade do ganho por 5% do custo: **deletar `server/routes/_ws.ts`** (morto) e **fundir os handlers Nitro que são repasse puro**, mantendo o Nest. Não resolve a arquitetura, mas para de pagar a duplicação todo dia.
