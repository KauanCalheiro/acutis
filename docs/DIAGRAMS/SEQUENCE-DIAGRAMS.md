# Diagramas de sequência

Cada fluxo que produz efeito no projeto, do clique até o arquivo em disco. Os nomes de rota, classe e evento são os do código: `server/api`, `core/use-cases`, `core/modules` e `core/webdriver`.

Os casos de uso vistos por ator estão em [USE-CASE-DIAGRAMS](USE-CASE-DIAGRAMS.md).

## Sumário

| # | Fluxo | Entrada | O que fica no projeto |
|---|-------|---------|----------------------|
| 1 | [Criar projeto local](#1-criar-projeto-local) | `POST /api/projects` | Pasta com template, `acutis.json`, `.gitignore` |
| 2 | [Clonar projeto de um repositório](#2-clonar-projeto-de-um-repositório) | `POST /api/projects/probe`, `POST /api/projects/clone` | Repositório clonado, `acutis.json` |
| 3 | [Configurar a IA](#3-configurar-a-ia) | `POST /api/settings/ai/models`, `/ping`, `PUT /api/settings/ai` | Nada no projeto, o cadastro é do acutis |
| 4 | [Definir a URL base e os ambientes](#4-definir-a-url-base-e-os-ambientes) | `PUT /api/projects/{slug}/settings` | `environments/*.json`, `.env`, `.env.example` |
| 5 | [Gravar a autenticação](#5-gravar-a-autenticação) | WebSocket + `POST /api/projects/{slug}/auth/record` | `tests/auth.setup.ts`, `storage-state.json` |
| 6 | [Gravar um cenário](#6-gravar-um-cenário) | WebSocket + `POST /tests/draft` + `POST /tests` | `tests/<domínio>/<nome>.spec.ts`, `.feature`, `.events.json` |
| 7 | [Retomar a gravação de um passo](#7-retomar-a-gravação-de-um-passo) | `START_RECORDING` com `replay` | Spec e gravação substituídos |
| 8 | [Executar um cenário](#8-executar-um-cenário) | `GET /api/projects/{slug}/run-stream` | `runs/<id>/history.ndjson`, vídeo, `results/` |
| 9 | [Executar os cenários filtrados](#9-executar-os-cenários-filtrados) | `run-stream` com `grep` | Um histórico por cenário que reportou |
| 10 | [Editar ou mover um cenário](#10-editar-ou-mover-um-cenário) | `PATCH /api/projects/{slug}/scenarios/{...}` | Arquivos reescritos ou renomeados |
| 11 | [Pular e voltar a rodar](#11-pular-e-voltar-a-rodar) | `PATCH /api/projects/{slug}/scenario-skip` | `test.describe.skip` no spec |
| 12 | [Excluir um cenário](#12-excluir-um-cenário) | `DELETE /api/projects/{slug}/scenarios/{...}` | Spec, feature e gravação removidos |
| 13 | [Corrigir o cenário com IA](#13-corrigir-o-cenário-com-ia) | `POST /api/projects/{slug}/scenario-fix` | Spec reescrito, se a proposta for aceita |
| 14 | [Sugerir data-testid](#14-sugerir-data-testid) | `POST /api/projects/{slug}/scenario-suggestions` | Nada, a sugestão é para o sistema testado |
| 15 | [O commit que toda ação faz](#15-o-commit-que-toda-ação-faz) | qualquer uma das anteriores | Commit e push no repositório do projeto |

## 1. Criar projeto local

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as server/api
  participant UC as CreateProject
  participant W as FileSystemProjectWriter
  participant FS as ~/.acutis/{slug}

  Pessoa->>App: informa o nome do projeto
  App->>API: POST /api/projects
  API->>API: prepareProjectTemplates()
  API->>UC: execute(name)
  UC->>W: create(name)
  W->>W: slug(name), recusa nome vazio ou repetido
  W->>FS: copia o template empacotado
  W->>FS: package.json com o slug
  W->>FS: writeManifest() grava acutis.json
  W->>FS: Environments.ensure() cria environments/ e .gitignore
  W-->>UC: Project
  UC-->>API: Project
  API-->>App: 201 com nome, slug e caminho
  App-->>Pessoa: abre a tela do projeto, pedindo a URL base
```

O projeto nasce sem git. Quem quiser versionar roda `git init` na pasta, e a partir daí o acutis passa a commitar sozinho, como no fluxo 15.

## 2. Clonar projeto de um repositório

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as server/api
  participant G as GitService
  participant UC as CloneProject
  participant W as FileSystemProjectWriter
  participant FS as ~/.acutis/{slug}

  Pessoa->>App: cola a URL do repositório
  App->>API: POST /api/projects/probe
  API->>G: probe(url) com git ls-remote
  alt repositório público
    G-->>App: público, sem credencial
  else repositório privado
    G-->>App: precisa de usuário e token
    Pessoa->>App: informa as credenciais
  end

  Pessoa->>App: confirma o clone
  App->>API: POST /api/projects/clone
  API->>UC: execute({ url, name, credenciais })
  UC->>W: clone(request)
  W->>G: clone(request, path)
  G->>FS: git clone e remote set-url sem credencial embutida
  W->>FS: writeManifest() grava acutis.json
  W->>FS: Environments.ensure()
  W->>G: remoteUrl() para descobrir o provedor
  W-->>API: Project com repository e provider
  API-->>App: 201
```

O `set-url` depois do clone é deliberado: a credencial serve à operação e não fica escrita no `.git/config`.

## 3. Configurar a IA

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as server/api/settings
  participant UC as SettingsUseCases
  participant S as SettingsService
  participant P as Provedor (Anthropic, OpenAI, Gemini, Ollama)
  participant DB as SQLite do acutis

  Pessoa->>App: escolhe o provedor e informa chave ou endereço
  App->>API: POST /api/settings/ai/models
  API->>UC: availableModels(dto)
  UC->>S: availableModels(dto)
  S->>P: lista os modelos
  P-->>App: modelos disponíveis

  Pessoa->>App: escolhe o modelo e pede o teste
  App->>API: POST /api/settings/ai/ping
  API->>S: ping(dto)
  S->>P: uma chamada curta de verificação
  P-->>App: respondeu, ou o motivo da recusa

  Pessoa->>App: salva
  App->>API: PUT /api/settings/ai
  API->>S: update(dto)
  S->>DB: settings.save(AI_PROVIDER cifrado)
  S->>DB: ai_credentials.save(chave cifrada, url, modelo)
  API-->>App: provedor ativo
```

A chave vai cifrada em AES-256-GCM, e a chave de cifra mora em `<raiz>/runtime/app-key`, fora do banco. Escolher "Sem IA" desliga sem apagar cadastro: o acutis segue gravando e executando, e só as ações da coluna com IA em [USE-CASE-DIAGRAMS](USE-CASE-DIAGRAMS.md#quando-a-ia-entra) ficam indisponíveis.

## 4. Definir a URL base e os ambientes

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as server/api
  participant PS as ProjectService
  participant E as Environments
  participant FS as pasta do projeto
  participant Git as Git do projeto

  Pessoa->>App: informa a URL do sistema sob teste
  App->>API: PUT /api/projects/{slug}/settings
  API->>PS: setBaseUrl(slug, baseUrl)
  PS->>E: set(URL, baseUrl)
  E->>FS: environments/{ambiente}.json
  E->>FS: .env com o ambiente ativo
  E->>FS: ensureGitignore() e .env.example
  PS->>Git: save('chore: atualizar configurações do projeto')
  API-->>App: base_url

  Pessoa->>App: cria um segundo ambiente e ativa
  App->>API: POST /api/projects/{slug}/environments
  App->>API: POST /api/projects/{slug}/environments/{env}/activate
  API->>E: activate(slug)
  E->>FS: .env aponta para o novo ambiente
```

Os valores ficam fora do git: `.env` e `environments/` estão no `.gitignore`, porque cada máquina tem os seus e alguns são segredo. O que se versiona é o `.env.example`, com as chaves.

## 5. Gravar a autenticação

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant WS as WebSocket /ws
  participant R as RecorderService
  participant Nav as Chrome com a pill
  participant API as server/api
  participant A as AuthService
  participant IA as Agente de auth
  participant PW as RunnerService
  participant FS as pasta do projeto
  participant Git as Git do projeto

  Pessoa->>App: Gravar login
  App->>WS: START_RECORDING mode=auth
  WS->>R: start(...)
  R->>Nav: abre a página e injeta a pill
  R-->>App: recorder:started

  Pessoa->>Nav: faz o login de verdade
  Nav-->>WS: eventos de clique, digitação e navegação
  WS-->>App: recorder:click, recorder:fill, recorder:navigate

  Pessoa->>App: Parar gravação
  App->>WS: STOP_RECORDING
  WS-->>App: recorder:stop com sessionId do vídeo e storageState

  Pessoa->>App: revisa os eventos e confirma
  App->>API: POST /api/projects/{slug}/auth/record
  API->>A: record(slug, input)
  A->>IA: gera o auth.setup.ts a partir dos eventos
  A->>FS: tests/auth.setup.ts
  A->>FS: tests/auth.events.json e auth.dom.json
  A->>FS: features/auth.feature, quando há IA
  A->>FS: environments com AUTH_USER e AUTH_PASSWORD
  A->>Git: save('test: atualizar a autenticação')

  App->>API: POST /api/projects/{slug}/run com spec=tests/auth.setup.ts
  API->>PW: executa o setup no navegador
  PW->>FS: storage-state.json com a sessão
  PW-->>App: passou ou falhou
  App-->>Pessoa: autenticação configurada, ou o passo que quebrou
```

A senha nunca entra no spec: ela vira variável do ambiente ativo, e o `auth.events.json` é gravado sem os valores sensíveis. O `storage-state.json` fica no `.gitignore`, porque é sessão e não fonte.

## 6. Gravar um cenário

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant WS as WebSocket /ws
  participant R as RecorderService
  participant Nav as Chrome com a pill
  participant API as server/api
  participant GN as GenerationService
  participant IA as Agentes de Gherkin e metadado
  participant FS as pasta do projeto
  participant Git as Git do projeto

  Pessoa->>App: Novo cenário, autenticado ou público
  opt cenário autenticado
    App->>API: roda tests/auth.setup.ts antes de abrir o navegador
    API-->>App: login falhou, não abre o navegador
  end
  App->>WS: START_RECORDING mode=scenario com storageState
  WS->>R: start(...)
  R->>Nav: abre a página com a sessão e injeta a pill

  Pessoa->>Nav: navega, clica, preenche
  Nav->>Nav: useSelectorCapture escolhe o seletor de cada alvo
  Nav-->>WS: evento com seletores, rótulo e recorte do DOM
  WS-->>App: eventos chegam na timeline ao vivo

  opt afirmar algo na tela
    Pessoa->>Nav: modo asserção na pill e clica no elemento
    Nav-->>WS: recorder:assert
  end

  Pessoa->>App: Parar gravação
  WS-->>App: recorder:stop com o vídeo da sessão

  Pessoa->>App: abre a revisão
  App->>API: POST /api/projects/{slug}/tests/draft
  API->>GN: draft(slug, dto)
  GN->>GN: SpecEmitter transforma eventos em Playwright
  GN->>IA: Gherkin, título, domínio e tags
  GN->>GN: checkSpec() aponta seletor frágil
  GN-->>App: rascunho com spec, gherkin, tags e ressalvas

  Pessoa->>App: ajusta nome, domínio e tags e salva
  App->>API: POST /api/projects/{slug}/tests
  API->>GN: write(slug, dto)
  GN->>FS: tests/{domínio}/{nome}.spec.ts
  GN->>FS: features/{domínio}/{nome}.feature
  GN->>FS: tests/{domínio}/{nome}.events.json e .dom.json
  GN->>Git: save('test: adicionar cenário {domínio}/{nome}')
  API-->>App: cenário criado
```

O rascunho é um passo separado de propósito: o spec chega à tela antes de existir arquivo, e é ali que se corrige o que a IA batizou.

## 7. Retomar a gravação de um passo

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant WS as WebSocket /ws
  participant R as RecorderService
  participant Nav as Chrome com a pill
  participant API as server/api

  Pessoa->>App: escolhe o passo na timeline
  App->>WS: START_RECORDING com replay dos eventos até ali
  WS->>R: start(..., replay)
  R->>Nav: refaz goto, fill e click, um a um
  Nav-->>App: a cortina da pill mostra o passo em andamento

  alt todos os passos refeitos
    R-->>App: recorder:replayed com quantos foram mantidos
  else um passo não repetiu
    R-->>App: recorder:replay-failed com o nome do passo
    Pessoa->>Nav: decide na própria janela gravada
    alt continuar daqui
      R-->>App: recorder:replayed, gravação cortada nesse passo
    else cancelar
      R-->>App: recorder:stop, nada é alterado
    end
  end

  Pessoa->>Nav: continua o fluxo de onde parou
  Nav-->>WS: eventos novos somados aos que sobraram
  Pessoa->>App: revisa e salva
  App->>API: PATCH /api/projects/{slug}/scenarios/{...} com spec e events
  API-->>App: spec e gravação substituídos
```

## 8. Executar um cenário

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as run-stream.get
  participant UC as RunScenario
  participant PS as ProjectService
  participant PW as RunnerService
  participant Rep as reporters/stream-reporter.cjs
  participant SH as StoreRunHistory
  participant FS as pasta do projeto
  participant Git as Git do projeto

  Pessoa->>App: Testar
  App->>API: GET /api/projects/{slug}/run-stream (SSE)
  API->>UC: stream(slug, spec, grep, onEvent)
  UC->>PS: resolvedEnvironment(slug)
  PS-->>UC: URL, credenciais e variáveis do ambiente ativo
  UC->>PW: streamProject(path, { spec, env })
  PW->>PW: playwright test --reporter=stream-reporter,html

  Rep-->>App: run:started com os passos declarados
  loop cada test.step
    Rep-->>App: step pendente
    Rep-->>App: step com sucesso ou falha, com duração e erro
  end
  Rep-->>App: test com status, duração e vídeo
  Rep-->>App: run:finished

  PW-->>UC: resultado, saída e caminho do vídeo
  UC->>UC: publica RunFinished
  UC->>SH: persistRun(path, spec, eventos, início)
  SH->>FS: runs/{id}/history.ndjson e last.webm
  SH->>Git: save('chore: registrar execução de {id}')
  API-->>App: fim do stream
  App-->>Pessoa: timeline, vídeo e o erro traduzido de cada passo
```

Passo vermelho traz a mensagem do Playwright já traduzida pela tela (`app/utils/run-failure.ts`), com a mensagem original disponível ao lado. Cenário pulado não entra: o Playwright reporta `skipped` sem executar.

## 9. Executar os cenários filtrados

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as run-stream.get
  participant UC as RunScenario
  participant PW as RunnerService
  participant SH as StoreRunHistory
  participant FS as pasta do projeto
  participant Git as Git do projeto

  Pessoa->>App: busca por título ou tag
  App->>App: runnable = filtrados sem os pulados
  Pessoa->>App: Rodar N filtrados
  App->>API: GET run-stream com grep dos títulos
  API->>UC: stream(slug, undefined, grep, onEvent)
  UC->>PW: streamProject com --grep
  loop cada cenário que casou
    PW-->>App: test e steps daquele cenário
  end
  UC->>SH: persistRuns(path, eventos, início)
  SH->>FS: um history.ndjson por cenário que reportou
  SH->>Git: save('chore: registrar execução de N cenário(s)')
```

## 10. Editar ou mover um cenário

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as scenarios/[...scenario].patch
  participant SS as ScenarioService
  participant FS as pasta do projeto
  participant Git as Git do projeto

  Pessoa->>App: muda título, caminho, domínio, tags ou o Gherkin
  App->>API: PATCH /api/projects/{slug}/scenarios/{...}
  API->>SS: update(slug, id, dto)
  SS->>SS: recusa nome que já existe no domínio
  SS->>SS: stampPlaywrightTitle e stampPlaywrightTags, preservando o skip
  SS->>FS: escreve o spec e o .feature no caminho novo
  opt o caminho mudou
    SS->>FS: apaga spec e feature antigos
    SS->>FS: renomeia .events.json e .dom.json
  end
  opt a revisão trouxe events
    SS->>FS: substitui a gravação, mascarando os sensíveis
  end
  SS->>Git: save('test: atualizar cenário {novo id}')
  API-->>App: cenário atualizado
```

## 11. Pular e voltar a rodar

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as scenario-skip.patch
  participant SS as ScenarioService
  participant FS as pasta do projeto
  participant Git as Git do projeto
  participant PW as Playwright

  Pessoa->>App: Pular
  App->>API: PATCH /api/projects/{slug}/scenario-skip
  API->>SS: skip(slug, id, true)
  SS->>FS: test.describe vira test.describe.skip no spec
  SS->>Git: save('test: pular cenário {id}')
  API-->>App: skipped true
  App-->>Pessoa: selo Pulado no cabeçalho e no card, Testar desabilitado

  Note over PW: qualquer execução, dentro ou fora do acutis, reporta skipped

  Pessoa->>App: Voltar a rodar
  App->>API: PATCH scenario-skip com skipped false
  SS->>FS: test.describe.skip volta a test.describe
  SS->>Git: save('test: voltar a rodar cenário {id}')
```

## 12. Excluir um cenário

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as scenarios/[...scenario].delete
  participant SS as ScenarioService
  participant FS as pasta do projeto
  participant Git as Git do projeto

  Pessoa->>App: Excluir e confirma
  App->>API: DELETE /api/projects/{slug}/scenarios/{...}
  API->>SS: remove(slug, id)
  SS->>FS: apaga o spec, o .events.json, o .dom.json e o .feature
  SS->>Git: save('test: remover cenário {id}')
  API-->>App: 204
  App-->>Pessoa: volta para a listagem do projeto
```

## 13. Corrigir o cenário com IA

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as scenario-fix.post
  participant AI as ScenarioAiUseCases
  participant IA as Agente spec-fixer
  participant SS as ScenarioService
  participant FS as pasta do projeto
  participant Git as Git do projeto

  Pessoa->>App: Corrigir, no passo que falhou
  App->>API: POST /api/projects/{slug}/scenario-fix
  API->>AI: fix(slug, scenarioId, passo, erro)
  AI->>IA: spec atual, passo e erro da execução
  IA-->>App: spec proposto e resumo do que mudou
  Pessoa->>App: compara e decide
  alt aceita
    App->>API: PATCH scenarios/{...} com o spec proposto
    API->>SS: update(...)
    SS->>FS: spec reescrito
    SS->>Git: save('test: atualizar cenário {id}')
  else descarta
    App-->>Pessoa: nada é alterado
  end
```

Sem provedor de IA cadastrado o botão Corrigir fica desabilitado, com a explicação no tooltip.

## 14. Sugerir data-testid

```mermaid
sequenceDiagram
  actor Pessoa
  participant App as Interface
  participant API as scenario-suggestions.post
  participant AI as ScenarioAiUseCases
  participant IA as Agente selector
  participant SR as selector-rules

  Pessoa->>App: Ver sugestões
  App->>API: POST /api/projects/{slug}/scenario-suggestions
  API->>AI: suggestions(slug, scenarioId)
  AI->>AI: separa os alvos com seletor frágil
  AI->>IA: propõe um data-testid por alvo
  IA-->>AI: sugestões em kebab-case
  AI->>SR: valida recurso-acao e kebab-case
  AI-->>App: sugestões com o seletor atual ao lado
  App-->>Pessoa: o que pedir para o time do sistema testado
```

Este é o único fluxo que não escreve nada: a mudança precisa acontecer no sistema sob teste, não no projeto de testes.

## 15. O commit que toda ação faz

```mermaid
sequenceDiagram
  participant S as Service da ação
  participant G as Git (core/modules/git/providers/git.ts)
  participant Repo as .git do projeto
  participant Remote as origin

  S->>G: save(mensagem, arquivos que a ação escreveu)
  G->>G: isRepository()? projeto sem git segue em frente
  loop cada arquivo
    G->>Repo: git add <arquivo>
    Note over G,Repo: caminho que não existe é ignorado, sem derrubar os outros
  end
  alt algo foi para o índice
    G->>Repo: git commit -m mensagem
    G->>Remote: git push origin HEAD
    Note over G,Remote: sem remote, sem credencial ou sem rede, o commit fica local
  else nada mudou
    G-->>S: sem commit
  end
```

Um `add` por arquivo é o que garante o commit: com uma lista só, um caminho inexistente (o `.dom.json` que a gravação não capturou) fazia o git recusar tudo, e a ação inteira ficava pendente.

O prefixo separa o que é teste do que é infraestrutura do projeto:

| Ação | Mensagem |
|------|----------|
| Criar cenário | `test: adicionar cenário <domínio>/<nome>` |
| Editar ou mover cenário | `test: atualizar cenário <id>` |
| Pular cenário | `test: pular cenário <id>` |
| Voltar a rodar | `test: voltar a rodar cenário <id>` |
| Excluir cenário | `test: remover cenário <id>` |
| Gravar ou editar a autenticação | `test: atualizar a autenticação` |
| Dispensar a autenticação | `chore: dispensar a autenticação do projeto` |
| Salvar as configurações | `chore: atualizar configurações do projeto` |
| Clonar o projeto | `chore: registrar o projeto no acutis` |
| Registrar a execução | `chore: registrar execução de <id>` |
