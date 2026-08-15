# Migrar o backend para Node e publicar como CLI

Mapeamento e plano para substituir o backend Laravel por código Node dentro do webdriver, e
distribuir o acutis como `npx acutis-cli`.

Levantado em 14/08/2026. Nada implementado.

## Por que

O motivo não é tamanho de bundle — o instalador cairia de 463 MB para ~410 MB, e o Chromium (539 MB)
continua dominando. São três outros:

1. **`npx acutis-cli` só existe sem PHP.** Não há caminho honesto para distribuir Laravel por npm: dá
   para um `postinstall` baixar o `php` estático, mas aí você mantém um instalador disfarçado de
   pacote, com os mesmos três alvos e um passo que falha atrás de proxy corporativo. Sem PHP, o
   pacote tem ~10 MB, o Chromium vai para o cache global compartilhado do Playwright, e some o
   capítulo inteiro de assinatura: sem certificado da Apple (US$ 99/ano), sem EV do Windows, sem
   Gatekeeper, sem SmartScreen. Publicar vira `npm publish`.
2. **Some o único risco em aberto do empacotamento.** O `php.exe` estático do Windows nunca foi
   verificado, e é o item que pode obrigar ao plano B do PHP oficial com `php.ini`.
3. **Um runtime a menos para vendorizar**, e o build deixa de precisar de PHP e Composer.

## Decisões

| Decisão | Escolha |
|---|---|
| Onde a API vai morar | **No webdriver (NestJS)**, como mais um módulo ao lado de recorder e runner |
| Nomes dos diretórios | `webdriver/` virou **`backend/`** (deixou de ser só o gravador); o Laravel virou **`backend-laravel/`** e sai na Fase 5 |
| Camada de proxy | O BFF Nitro **continua** repassando; os 35 handlers seguem como estão |
| Estratégia | **Por camada, de uma vez** — sem período de convivência entre os dois backends |
| Distribuição | **Só o CLI** por ora; o instalador desktop fica engavetado nos PRs [#138](https://github.com/KauanCalheiro/acutis/pull/138) e [#139](https://github.com/KauanCalheiro/acutis/pull/139) |
| Inteligência artificial | **Fora do escopo.** Toda chamada de IA devolve um objeto fixo |
| Ordem do trabalho | **Todos os testes primeiro**, depois as implementações |

## A IA fica para depois

Nenhum agente é portado agora. Os endpoints que hoje chamam modelo continuam existindo e respondendo
o mesmo formato, mas o que devolvem vem de um objeto fixo em vez de uma geração. O contrato com o
frontend não muda — a tela não sabe a diferença.

Isso reorganiza o que era a Fase 3:

| Parte de `app/Ai` | Destino |
|---|---|
| `Rules/` (21 arquivos, 427 linhas de teste) | **Portadas.** São validadores determinísticos do código gerado, não usam modelo nenhum, e continuam valendo |
| Agentes, `Prompts/`, `Attempt`, `SpecRunner` | **Não portados.** Ficam para quando a IA voltar; o `laravel/ai` sai junto com o backend |
| Configuração de provedor (`Setting`, `AiSetting`) | **Portada.** A tela de configurações continua funcionando, e é o que reativa a IA depois |

O ponto de reentrada fica isolado num único módulo: quando a IA voltar, é ele que troca o objeto
fixo por uma chamada ao AI SDK, sem tocar em Actions nem em controllers.

Resultado: dois processos em vez de três.

```
npx acutis-cli
├── node .output/server/index.mjs   Nuxt + BFF (proxy)
└── node backend/dist/main.js       API + gravador + runner
```

---

# Mapeamento

## O tamanho do que sai

| Área | Arquivos | Linhas |
|---|---:|---:|
| `app/Action` — casos de uso | 35 | 2.189 |
| `app/Support` — arquivos de projeto, git, emissão de spec | 17 | 2.259 |
| `app/Ai` — agentes, prompts e regras | 42 | 1.538 |
| `app/Http` + `app/Data` — controllers, resources, validação | 52 | 1.689 |
| `app/Models` + `app/Enums` | 6 | 168 |
| **Produção** | **181** | **8.394** |
| Testes (Pest) | 46 | 5.865 |

## O que o backend guarda em banco

Quase nada, e esse é o achado que torna a migração viável: **7 migrations e 2 modelos usados**
(`Setting`, `AiSetting`), que guardam a configuração de IA. O `User` tem **zero** referências — é
resquício do skeleton do Laravel e some sem substituto.

Todo o estado do produto — projetos, cenários, gravações, ambientes, histórico de execuções — vive
como **arquivos** em `~/.acutis/<projeto>`. O Eloquent, que seria a parte mais cara de substituir,
mal é exercitado.

## As 35 Actions, por dependência

| Dependência | Quantas | Quais |
|---|---:|---|
| Só arquivo | 20 | criação/leitura/escrita de projeto, cenário, ambiente, auth |
| Git | 7 | `ListProjects`, `ShowProject`, `UpdateProject`, `CloneProjectFromGit`, `ProbeGitRepository`, `PersistScenarioRun`, `ShowCapabilities` |
| IA | 6 | `GenerateTestsFromRecording`, `FixScenarioSpec`, `SuggestScenarioSelectors`, `WriteAuthRecordingToProject`, `GenerateAuthSetupFromRecording`, `ShowAiSettings` |
| Webdriver (HTTP) | 2 | `RunProject`, `GenerateAuthSetupFromRecording` — **viram chamada de função local** |
| Banco | 2 | `ShowAiSettings`, `UpdateAiSettings` |

As duas que hoje falam HTTP com o webdriver deixam de atravessar a rede: passam a ser chamadas
diretas dentro do mesmo processo Nest.

## O núcleo difícil: `app/Support`

É aqui que mora o risco da migração — não na quantidade de linhas, mas na densidade dos casos de
borda descobertos ao longo do projeto.

| Arquivo | Linhas | O que faz |
|---|---:|---|
| `Recording/SpecEmitter.php` | **549** | transforma a gravação em spec Playwright — o coração do produto |
| `Project/Environments.php` | 358 | ambientes, variáveis e o `.env` de cada projeto |
| `Recording.php` | 269 | normaliza os eventos gravados |
| `Scenario.php` | 158 | leitura e escrita dos cenários |
| `TestArtifact.php` | 146 | artefatos de execução (vídeo, trace, html de falha) |
| `Project/Env.php` | 146 | leitura e escrita de `.env` |
| `Git.php` | 107 | clone, commit, push, leitura de remote |
| demais | 426 | config, gitignore, auth, runs, primitivas |

## `app/Ai`

Seis agentes (`GherkinWriter`, `ScenarioValidator`, `ScenarioFixer`, `SelectorWriter`,
`AuthValidator`, `AuthFixer`) e o que o `laravel/ai` fornece a eles: `Agent`, `Promptable`,
`HasStructuredOutput`, e os atributos `Timeout`, `UseCheapestModel`, `UseSmartestModel`.

As `Rules/` (21 arquivos) **não usam IA**: são validadores determinísticos do código gerado
(`ActionAwait`, `Comment`, `Kebab`, `ResourceAction`, `StorageState`…). Portam-se como funções puras,
e são a parte mais fácil e mais bem testada do conjunto.

## Equivalências

| Hoje | Em Node | Observação |
|---|---|---|
| `lorisleiva/laravel-actions` | funções exportadas | as Actions já são quase isso |
| `spatie/laravel-data` | **zod** | o frontend já usa zod; os schemas podem ser compartilhados via `shared/` |
| Eloquent + migrations | `better-sqlite3` | 7 migrations, 2 tabelas de configuração |
| `laravel/ai` | **Vercel AI SDK** | `generateObject` + schema zod cobre `HasStructuredOutput`; `Timeout`/`UseCheapestModel` viram parâmetros |
| Controllers + Resources | controllers Nest | o webdriver já tem a estrutura |
| Symfony Process | `node:child_process` | o webdriver já usa |
| Pest | Vitest | o webdriver já usa |
| Telescope | — | sem equivalente; é ferramenta de debug e sai sem substituto |

## A rede de segurança

**157 testes E2E** em 10 specs, exercitando a stack inteira pelo navegador:

| Spec | Testes | | Spec | Testes |
|---|---:|---|---|---:|
| `scenario` | 35 | | `runner` | 22 |
| `project` | 24 | | `home` | 20 |
| `recording` | 23 | | `settings` | 8 |
| `theme-color` | 6 | | `navbar` | 5 |
| `webdriver-bundle` | 1 | | `native-recording-poc` | 1 |

Como a suíte fala com o produto por HTTP e pelo navegador, **ela não sabe em que linguagem o backend
está escrito** — é o contrato que valida a migração. Os 5.865 linhas de teste Pest, ao contrário, são
descartados e reescritos junto com o código que testam.

---

# Plano

A escolha foi migrar de uma vez, sem convivência entre os dois backends. Para que "de uma vez" não
signifique "às cegas", o trabalho é ordenado de baixo para cima: cada camada é portada com seus
testes antes que a seguinte comece, e o Laravel só é apagado no último passo. A suíte E2E fica
vermelha durante a transição — é o custo aceito desta estratégia — e voltar a verde é o critério de
pronto.

Cada fase termina com testes Vitest próprios. A ordem não é negociável: cada uma depende da anterior.

## Fase 1 — Fundação

Sem isto, nada mais compila.

- `acutis.config.ts` — o equivalente ao `config/acutis.php`: caminho dos projetos, `ACUTIS_GIT_BIN`, URL do webdriver
- SQLite com `better-sqlite3` e as duas tabelas de configuração; as 7 migrations viram um `schema.sql`
- schemas zod para as entidades que hoje são `Data` (projeto, cenário, ambiente, auth)

**Pronto quando:** as configurações de IA gravam e leem, com teste.

## Fase 2 — `Support`, o núcleo de arquivos

A maior e mais arriscada. Portar na ordem de dependência:

1. `Primitives/` (Url, Playwright, Environments) — funções puras, sem I/O
2. `Project/Env`, `Project/Gitignore`, `Project/Auth`
3. `Project/Environments` (358 linhas)
4. `Scenario`, `Scenario/Runs`, `TestArtifact`
5. `Recording` (269 linhas)
6. **`SpecEmitter` (549 linhas)** — por último, porque depende de tudo acima
7. `Git` — com `ACUTIS_GIT_BIN` e o `HOME` do usuário preservado

**Pronto quando:** os testes de `SpecEmitterTest`, `RecordingTest` e `TestArtifactTest` — hoje em
Pest — existirem em Vitest, com os mesmos casos, e passarem.

> O `SpecEmitter` merece tratamento à parte: é o único arquivo em que traduzir linha a linha é mais
> seguro do que reescrever com liberdade. Os casos de borda dele foram descobertos um a um, e o teste
> Pest correspondente é a especificação real do que ele faz.

## Fase 3 — IA

- Trocar `laravel/ai` pelo **Vercel AI SDK**, com `generateObject` e schema zod
- Portar as 21 `Rules/` — funções puras, tradução direta
- Portar os 6 agentes e seus prompts
- Manter o provedor configurável e a degradação já existente: **sem chave, o acutis funciona sem IA**

**Pronto quando:** os agentes devolverem a mesma estrutura para as mesmas entradas, e as regras
reprovarem o que hoje reprovam.

## Fase 4 — Actions e HTTP

- 35 Actions viram funções, agrupadas por assunto (projeto, cenário, ambiente, auth, configurações)
- Controllers Nest para os 31 endpoints, no mesmo caminho `/api/v1/*` que o BFF já chama
- `RunProject` e `GenerateAuthSetupFromRecording` deixam de fazer HTTP e passam a chamar o runner e o
  recorder direto

**Pronto quando:** cada endpoint responder o mesmo JSON que o Laravel responde hoje.

## Fase 5 — A troca ✅

- ~~Apontar o `useClients` do BFF para o webdriver~~ — feito: `nuxt.config.ts` e o compose apontam
  para a porta 4000
- ~~Rodar a suíte E2E inteira~~ — feito, verde
- ~~Apagar o Laravel, tirar PHP e Composer do `dev.sh`, do compose e da documentação~~ — feito;
  `backend-laravel/` não existe mais

O que sobrou do Laravel no repositório é comentário de proveniência nos `*.spec.ts` ("portado de
`backend-laravel/tests/...`"), de propósito: é o rastro de onde cada teste veio.

**Uma perda assumida:** o Telescope não tem equivalente no Nest. No lugar dele entrou o diário de
requisições (`backend/src/common/interceptors/request-log.interceptor.ts`), que grava uma linha JSON por requisição com
payload, tempos e as chamadas HTTP disparadas para fora — sem UI, e sem dependência nova.

## Fase 6 — O CLI

- Pacote `acutis-cli` (`acutis` está tomado por um projeto abandonado de 2023; `acutis-cli` e
  `@acutis/cli` estão livres)
- Um `bin` que sobe os dois processos, escolhe portas livres e abre o navegador padrão — é o
  `main.js` do Electron sem a janela, e o boot já está resolvido nos dois shells
- Chromium **fora do pacote**: `playwright install chromium` na primeira execução, no cache global
  compartilhado
- `npm publish` no CI, por tag

**Pronto quando:** `npx acutis-cli` funcionar numa máquina que só tem Node.

---

## Riscos

| Risco | Mitigação |
|---|---|
| O `SpecEmitter` perder um caso de borda em silêncio | traduzir linha a linha, e portar o teste Pest antes do código |
| A suíte E2E ficar vermelha por muito tempo, escondendo regressões | ordem de baixo para cima, com testes Vitest por fase; a E2E é o critério final, não o único |
| O AI SDK divergir do `laravel/ai` no structured output | Fase 3 isolada, com os agentes comparados contra as mesmas entradas |
| Perder o Telescope | não há substituto; avaliar se fazia falta de verdade |
| Ser um TCC perto da entrega | 8.394 linhas de produção mais 5.865 de teste é reescrita grande; ver abaixo |

## A ressalva que não cabe numa tabela

Este repositório é a versão final do TCC, e o que está sendo trocado funciona e está testado. A
migração vale pelo que destrava — `npx acutis-cli` e o fim do risco do PHP no Windows —, não por
correção técnica: não há nada errado com o backend atual.

Antes de começar, **rodar o workflow no Windows**. São minutos de CI, e o resultado muda a urgência:
se o PHP estático funcionar lá, existe um instalador completo e pronto enquanto a migração acontece
com calma. Se falhar, a migração ganha uma justificativa a mais.
