# Diagramas de casos de uso

O que o acutis faz, visto por quem usa e por quem é usado. A ordem dos passos de cada fluxo está em [SEQUENCE-DIAGRAMS](SEQUENCE-DIAGRAMS.md), com o endpoint e a classe de cada um; o passo a passo para quem está começando está no [guia rápido](../QUICK-START.md).

## Sumário

| # | Diagrama | Responde |
|---|----------|----------|
| 1 | [Atores e sistemas](#1-atores-e-sistemas) | Quem age e com quem o acutis fala |
| 2 | [Panorama dos casos de uso](#2-panorama-dos-casos-de-uso) | Tudo que a pessoa pode fazer, por pacote |
| 3 | [Ciclo de vida da ferramenta](#3-ciclo-de-vida-da-ferramenta) | Como o acutis sobe e o que ele carrega junto |
| 4 | [Projeto](#4-projeto) | Criar, clonar, configurar, abrir e apagar |
| 5 | [Ambientes](#5-ambientes) | Onde moram URL, credenciais e variáveis |
| 6 | [Autenticação](#6-autenticação) | Como o login entra nos cenários |
| 7 | [Cenário](#7-cenário) | Gravar, revisar, editar, pausar e excluir |
| 8 | [Execução](#8-execução) | Rodar um, rodar os filtrados e acompanhar |
| 9 | [Relatórios](#9-relatórios) | O que sobra de todas as execuções |
| 10 | [Sincronização com o repositório](#10-sincronização-com-o-repositório) | Como o time compartilha os testes |
| 11 | [Configuração de IA](#11-configuração-de-ia) | Escolher provedor, modelo e desligar |
| 12 | [Telemetria](#12-telemetria) | O que sai da máquina, e só por clique |
| 13 | [Quando a IA entra](#13-quando-a-ia-entra) | O que muda com e sem provedor |
| 14 | [Os estados que a tela mostra](#14-os-estados-que-a-tela-mostra) | Autenticação, cenário e repositório |
| 15 | [O que cada ação escreve no projeto](#15-o-que-cada-ação-escreve-no-projeto) | Qual arquivo nasce de qual caso de uso |

## 1. Atores e sistemas

```mermaid
flowchart LR
  Pessoa(("Pessoa que testa"))
  Time(("Time do sistema<br/>sob teste"))

  subgraph Acutis["Acutis (um processo Nuxt e Nitro)"]
    UI["Interface"]
    API["API, WebSocket e SSE"]
    REC["Gravador"]
    RUN["Runner"]
    DB["SQLite de configuração"]
  end

  SUT["Sistema sob teste<br/>no navegador"]
  FS["~/.acutis/{slug}<br/>projeto em disco"]
  GIT["Repositório remoto<br/>GitHub ou GitLab"]
  IA["Provedor de IA<br/>Anthropic, OpenAI, Gemini,<br/>OpenRouter, Ollama, Claude Agent, Codex"]
  PW["Playwright"]
  VS["VS Code"]
  TEL["Telemetria de erro"]

  Pessoa --> UI --> API
  API --> REC --> SUT
  API --> RUN --> PW --> SUT
  API --> FS
  API --> DB
  FS --> GIT
  API -.->|opcional| IA
  API -.->|só por clique| TEL
  Pessoa -.->|abre a pasta| VS --> FS
  Pessoa -.->|pede data-testid| Time --> SUT
```

O gravador e o runner falam com o mesmo navegador, em momentos diferentes: um observa a pessoa usando o sistema, o outro repete o que ela fez. Tudo que a ferramenta produz mora em disco, dentro da pasta do projeto, e é o git que leva isso ao resto do time.

## 2. Panorama dos casos de uso

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Ferramenta
    ST["Subir o acutis (npx @acutis/cli)"]
    LG["Enviar os logs de um erro"]
  end

  subgraph Projeto
    C["Criar projeto local"]
    K["Clonar repositório"]
    PB["Verificar se o repositório é público"]
    L["Listar, buscar e abrir"]
    U["Definir a URL base"]
    US["Dispensar a URL base"]
    RN["Renomear projeto"]
    VS["Abrir no VS Code"]
    CP["Copiar o caminho"]
    SY["Sincronizar com o repositório"]
    DL["Apagar projeto"]
  end

  subgraph Ambientes
    EN["Criar e editar ambiente"]
    EA["Ativar ambiente"]
    ED["Apagar ambiente"]
    CR["Guardar credenciais"]
  end

  subgraph Autenticação
    A["Gravar o login"]
    AE["Editar o auth.setup"]
    AR["Executar o login"]
    AS["Dispensar o login"]
  end

  subgraph Cenário
    G["Gravar cenário"]
    GP["Gravar cenário público"]
    D["Rascunhar a partir da gravação"]
    W["Revisar e salvar"]
    E["Editar ou mover"]
    Y["Retomar de um passo"]
    SK["Pausar ou voltar a rodar"]
    X["Excluir"]
  end

  subgraph Execução
    R["Executar um cenário"]
    RF["Executar os filtrados"]
    LV["Acompanhar ao vivo"]
    H["Ver histórico e vídeo"]
    FA["Ver o erro do passo que quebrou"]
  end

  subgraph Relatórios
    RG["Ver o relatório do projeto"]
    RR["Abrir uma rodada"]
    RC["Comparar com a rodada anterior"]
    RS["Ver o cenário que mais falha"]
    RP["Abrir o relatório do Playwright"]
  end

  subgraph IA["Configuração de IA"]
    I["Escolher provedor e modelo"]
    M["Listar modelos"]
    T["Testar o modelo"]
    F["Corrigir cenário"]
    S["Sugerir data-testid"]
    O["Escolher Sem IA"]
  end

  P --> ST
  P --> C & K & L & U & RN & VS & CP & DL
  P --> EN & EA & CR
  P --> A & AE & AS
  P --> G & GP & E & SK & X
  P --> R & RF & H
  P --> RG & RP
  P --> I & F & S & O
  P --> LG

  K --> PB
  U --> US
  EN --> ED
  G --> D --> W
  GP --> D
  W --> R
  R --> LV --> FA
  RF --> LV
  H -.->|passo que quebrou| Y --> W
  FA -.-> F
  I --> M --> T
  A --> AR
  AR -.->|storage-state.json| R
  EA -.->|URL e variáveis| R
  SK -.->|fica fora| RF
  RF --> RG --> RR --> RC
  RG --> RS
  RR -.->|cenário da rodada| H
  L --> SY
  R -.->|histórico novo| SY
```

## 3. Ciclo de vida da ferramenta

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Casos de uso
    NPX["npx @acutis/cli"]
    CH["Baixar o Chromium na primeira vez"]
    PT["Escolher uma porta livre"]
    OP["Abrir o navegador na interface"]
    QT["Encerrar com Ctrl+C"]
  end

  NITRO["Um processo Nitro:<br/>interface, API, gravador e runner"]
  DB["SQLite em <raiz>/runtime"]
  HOME["~/.acutis com os projetos"]

  P --> NPX --> CH
  NPX --> PT --> NITRO --> OP
  NITRO --> DB
  NITRO --> HOME
  P --> QT --> NITRO
```

Não há instalação, serviço nem container: o comando sobe tudo numa porta livre da máquina e abre o navegador nela. O que sobrevive entre execuções são os projetos em `~/.acutis` e o banco de configuração da ferramenta.

## 4. Projeto

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Casos de uso
    C["Criar projeto local"]
    K["Clonar repositório"]
    PB["Verificar se é público"]
    KT["Clonar com token"]
    KS["Clonar com chave SSH"]
    L["Listar, buscar e paginar"]
    O["Abrir o projeto"]
    RN["Renomear"]
    U["Definir a URL base"]
    US["Dispensar a URL base"]
    VS["Abrir no VS Code"]
    CP["Copiar o caminho"]
    DL["Apagar"]
  end

  FS["Pasta em ~/.acutis/{slug}"]
  GIT["git clone e remote"]

  P --> C --> FS
  P --> K --> PB
  PB --> KT & KS
  K --> GIT --> FS
  P --> L --> O
  P --> RN --> FS
  P --> U --> FS
  U --> US
  P --> VS --> FS
  P --> CP
  P --> DL --> FS
```

Um diretório vira projeto quando tem `acutis.json`. Criar copia o template empacotado; clonar traz um repositório que já existe e acrescenta o manifesto. Repositório privado pede token ou chave SSH, e nenhum dos dois fica gravado no `.git/config`. Apagar remove a pasta inteira, com os testes dentro.

## 5. Ambientes

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Casos de uso
    N["Criar ambiente"]
    E["Editar variáveis"]
    SE["Marcar variável como segredo"]
    A["Ativar ambiente"]
    D["Apagar ambiente"]
    C["Guardar credenciais do login"]
    PD["Preencher variável pendente"]
  end

  V["environments/{slug}.json<br/>fora do git"]
  ENV[".env com o ambiente ativo<br/>fora do git"]
  EX[".env.example<br/>versionado"]
  RUN["Execução do Playwright"]

  P --> N --> V
  P --> E --> V
  E --> SE
  P --> D --> V
  P --> A --> ENV
  P --> C --> V
  P --> PD --> V
  V --> EX
  ENV --> RUN
  V --> RUN
```

O ambiente ativo entra na execução como ambiente do processo: URL, usuário, senha e o que mais o cenário usar chegam ao Playwright sem que o spec mencione valor nenhum. Marcar uma variável como segredo muda a máscara na tela, não onde ela é guardada. Variável declarada e sem valor no ambiente ativo derruba a execução, então a tela do projeto avisa antes de rodar.

## 6. Autenticação

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Casos de uso
    V["Ver o estado do login"]
    G["Gravar o login"]
    E["Editar o auth.setup"]
    S["Dispensar o login"]
    R["Executar o auth.setup"]
    CR["Informar as credenciais à mão"]
  end

  SPEC["tests/auth.setup.ts"]
  ST["storage-state.json<br/>fora do git"]
  CEN["Cenário autenticado"]
  PUB["Cenário @publico"]

  P --> V
  P --> G --> SPEC
  P --> E --> SPEC
  P --> S
  P --> CR
  G --> R --> ST --> CEN
  SPEC --> R
  CR -.->|AUTH_USER e AUTH_PASSWORD| R
  PUB -.->|roda sem sessão| CEN
```

Quatro estados aparecem na tela: nunca configurado, dispensado, configurado e falhando. O último vem da execução do próprio `auth.setup.ts`: é ela que decide se o login ainda funciona. Gravação em que a senha não pôde ser deduzida pede as credenciais na tela, e elas viram variáveis do ambiente ativo. Cenário marcado `@publico` roda sem sessão, o que permite testar a própria tela de login.

## 7. Cenário

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Gravação
    G["Gravar cenário autenticado"]
    GP["Gravar cenário público"]
    AS["Afirmar algo na tela"]
    Y["Retomar de um passo"]
    RG["Regravar do zero"]
  end

  subgraph Revisão
    D["Rascunhar"]
    NM["Nomear, escolher domínio e tags"]
    WR["Ler as ressalvas do rascunho"]
    W["Revisar e salvar"]
  end

  subgraph Manutenção
    E["Editar título, caminho, tags e Gherkin"]
    MV["Mover de domínio"]
    SK["Pausar ou voltar a rodar"]
    X["Excluir"]
    F["Corrigir com IA"]
    S["Sugerir data-testid"]
  end

  SPEC["tests/{domínio}/{nome}.spec.ts"]
  FEAT["features/{domínio}/{nome}.feature"]
  EV["{nome}.events.json e {nome}.dom.json"]

  P --> G --> AS
  P --> GP --> AS
  G --> D
  GP --> D
  D --> NM --> W
  D --> WR
  W --> SPEC & FEAT & EV
  P --> Y --> W
  P --> RG --> D
  P --> E --> SPEC
  E --> MV
  P --> SK --> SPEC
  P --> X --> SPEC
  P --> F --> SPEC
  P --> S
  EV --> Y
```

A gravação fica guardada ao lado do spec (`.events.json`, e o recorte de DOM em `.dom.json`), e é ela que permite retomar de um passo depois. Pausar marca o `describe` como `skip` no próprio arquivo, então vale também para quem rodar o Playwright fora do acutis.

## 8. Execução

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Casos de uso
    R["Executar um cenário"]
    RM["Executar pelo menu do card"]
    RF["Executar os filtrados"]
    RA["Executar o auth.setup"]
    ST["Acompanhar ao vivo"]
    FA["Ler o erro traduzido do passo"]
    H["Ver o histórico do cenário"]
    VD["Assistir ao vídeo"]
    PWS["Ver o Playwright que rodou"]
  end

  PW["playwright test"]
  REP["stream-reporter"]
  HIST["runs/{id}/history.ndjson"]
  SUITE["runs/_suite/history.ndjson"]
  WEBM["runs/{id}/last.webm"]

  P --> R --> PW
  P --> RM --> PW
  P --> RF --> PW
  P --> RA --> PW
  PW --> REP --> ST --> FA
  REP --> HIST --> H
  REP --> SUITE
  PW --> WEBM --> VD
  H --> VD
  H --> PWS
```

Cada execução deixa quatro coisas: a linha do tempo passo a passo, o vídeo, o código Playwright que rodou naquele momento e, quando vermelha, o HTML da página no instante da falha. O histórico por cenário guarda a execução avulsa e a que veio de uma rodada; a rodada inteira também vira uma linha própria, que é o que o relatório do projeto lê. A tela reabre execuções antigas com o mesmo desenho da execução ao vivo.

## 9. Relatórios

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Capa do projeto
    RG["Ver as métricas gerais"]
    TR["Ver a evolução por rodada"]
    RK["Ver o ranking do que mais falha"]
    FL["Identificar cenário instável"]
    MX["Ver a matriz cenário por rodada"]
    PG["Paginar as rodadas"]
  end

  subgraph Uma rodada
    RR["Abrir uma rodada"]
    RC["Comparar com a anterior"]
    BR["Ver o que quebrou, voltou, entrou e saiu"]
    SL["Ver onde a rodada demorou"]
    LK["Ir ao cenário naquela execução"]
  end

  subgraph Playwright
    RP["Abrir o relatório HTML"]
    TC["Ver trace, vídeo e anexos"]
  end

  SUITE["runs/_suite/history.ndjson<br/>as últimas 50 rodadas"]
  HIST["runs/{id}/history.ndjson"]
  PWR["playwright-report/"]

  P --> RG --> TR & RK & MX & PG
  RK --> FL
  P --> RR --> RC --> BR
  RR --> SL
  RR --> LK --> HIST
  P --> RP --> TC
  SUITE --> RG
  SUITE --> RR
  PWR --> RP
```

O relatório do projeto é do acutis e lê o histórico versionado, então quem clonar o repositório vê as rodadas que os outros rodaram. O relatório HTML é o do Playwright, gerado pela última execução daquela máquina, e é para onde se vai quando o assunto é trace e anexo.

## 10. Sincronização com o repositório

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Casos de uso
    AB["Abrir o projeto ou o cenário"]
    AC["Fazer qualquer ação que escreve"]
    RS["Resolver conflito no console do git"]
  end

  SY["Sincronizar (fetch, rebase e push)"]
  OK["Sincronizado"]
  CF["Conflito, marca no atalho do VS Code"]
  UN["Remoto indisponível, o projeto segue local"]

  P --> AB --> SY
  P --> AC --> SY
  SY --> OK
  SY --> CF --> RS
  SY --> UN
  RS -.->|na próxima ação| SY
```

A sincronização acontece sozinha e não aparece em lugar nenhum enquanto dá certo. Só dois casos chegam à tela, e nenhum dos dois interrompe o trabalho: conflito de verdade (o mesmo arquivo mudou dos dois lados, ou há alteração local sem commit) e remoto que não respondeu. Conflito não é resolvido pela ferramenta: o rebase é abortado e quem decide é quem conhece os dois lados.

## 11. Configuração de IA

```mermaid
flowchart LR
  P(("Pessoa"))

  subgraph Casos de uso
    V["Ver o provedor ativo"]
    K["Informar chave ou endereço"]
    M["Listar modelos"]
    T["Testar o modelo"]
    U["Salvar provedor e modelo"]
    O["Escolher Sem IA"]
  end

  subgraph Provedores
    HTTP["Por HTTP:<br/>Anthropic, OpenAI, Gemini,<br/>OpenRouter, Ollama"]
    LOCAL["Por binário já autenticado:<br/>Claude Agent, Codex"]
  end

  DB["SQLite do acutis<br/>chave cifrada em AES-256-GCM"]

  P --> V
  P --> K --> HTTP
  P --> M --> HTTP & LOCAL
  P --> T --> HTTP & LOCAL
  P --> U --> DB
  P --> O --> DB
  M --> U
  T --> U
```

A instalação nasce sem IA. Os provedores por HTTP pedem chave (Ollama e os locais não pedem); Claude Agent e Codex não falam HTTP, rodam a ferramenta instalada na máquina, que já está autenticada. A variável `AI_PROVIDER` pré-configura o provedor antes da primeira tela, e "Sem IA" desliga sem apagar cadastro nenhum.

## 12. Telemetria

```mermaid
flowchart LR
  P(("Pessoa"))

  ER["Erro na tela, com o motivo do servidor"]
  BT["Clicar em Enviar logs"]
  RD["Ocultar caminho de casa, ambiente e segredo"]
  API["API de telemetria"]

  P --> ER --> BT --> RD --> API
```

Nada sai da máquina sozinho: o envio é sempre um clique na notificação de erro, e o que vai é a mensagem, o stack, a versão do CLI, a do Node, a plataforma e um identificador da instalação. Caminho de casa, variáveis de ambiente e valores sensíveis são ocultados antes do envio.

## 13. Quando a IA entra

| Caso de uso | Com provedor | Sem provedor |
|-------------|--------------|--------------|
| Rascunhar cenário | Escreve o Gherkin, o título, o domínio e as tags, e nomeia os passos do spec | O spec sai dos eventos gravados, sem Gherkin e sem metadado |
| Gravar a autenticação | Escreve o `auth.setup.ts`, corrige o que as regras apontarem, executa e tenta de novo até duas vezes, e escreve o `auth.feature` | Escreve o `auth.setup.ts` a partir dos eventos, sem correção e sem Gherkin |
| Corrigir cenário | Reescreve o spec a partir do que as regras apontaram e da gravação, com o passo que falhou visível na tela | Botão desabilitado |
| Sugerir data-testid | Propõe um nome por alvo frágil | Botão desabilitado |

Gravar, revisar, salvar, executar, pausar, ver o resultado e ler os relatórios nunca dependem de IA.

## 14. Os estados que a tela mostra

### Autenticação do projeto

```mermaid
stateDiagram-v2
  [*] --> unset
  unset --> skipped: dispensar o login
  unset --> configured: gravar o login e o setup passar
  skipped --> configured: gravar o login mesmo assim
  configured --> failing: a execução do auth.setup falhou
  failing --> configured: regravar ou editar e passar
```

O estado não é um campo que alguém marca: `configured` e `failing` saem da última execução do `auth.setup.ts` guardada no histórico.

### Cenário

```mermaid
stateDiagram-v2
  [*] --> gravando: novo cenário
  gravando --> rascunho: parar a gravação
  rascunho --> gravando: regravar ou retomar de um passo
  rascunho --> salvo: revisar e salvar
  rascunho --> [*]: descartar
  salvo --> salvo: editar, mover, corrigir com IA
  salvo --> pausado: pausar
  pausado --> salvo: voltar a rodar
  salvo --> [*]: excluir
```

Rascunho não existe em disco: até salvar, o que há é o spec na tela.

### Repositório do projeto

```mermaid
stateDiagram-v2
  [*] --> synced
  synced --> conflict: o mesmo arquivo mudou dos dois lados
  synced --> unavailable: rede, credencial ou remoto fora
  unavailable --> synced: a próxima ação sincronizou
  conflict --> synced: resolvido no console do git
```

Projeto sem git nunca sai de `synced`: toda operação de repositório é inócua fora de um.

## 15. O que cada ação escreve no projeto

| Caso de uso | Arquivos | Versiona |
|-------------|----------|----------|
| Criar projeto local | template, `acutis.json`, `.gitignore`, `environments/` | o projeto nasce sem git |
| Clonar repositório | repositório clonado, `acutis.json` | sim, ao salvar a primeira configuração |
| Definir a URL base | `environments/*.json`, `.env`, `.env.example`, `.gitignore` | `.env.example` e `.gitignore` |
| Criar ou ativar ambiente | `environments/*.json`, `.env` | nada, os dois estão no `.gitignore` |
| Gravar a autenticação | `tests/auth.setup.ts`, `auth.events.json`, `auth.dom.json`, `features/auth.feature`, `playwright.config.ts`, `storage-state.json` | tudo, menos o `storage-state.json` e o `auth.dom.json` |
| Guardar as credenciais do login | `environments/*.json`, `.env` | nada |
| Dispensar a autenticação | `acutis.json` | sim |
| Salvar cenário | `tests/.../*.spec.ts`, `features/.../*.feature`, `*.events.json`, `*.dom.json` | sim, o `.dom.json` fica fora pelo `.gitignore` |
| Editar ou mover cenário | os mesmos, no caminho novo | sim, com a remoção dos antigos |
| Pausar ou voltar a rodar | o spec | sim |
| Excluir cenário | remove spec, feature e gravação | sim |
| Executar um cenário | `runs/{id}/history.ndjson`, `last.webm`, `results/`, `failure.html`, `playwright-report/` | só o histórico do cenário |
| Executar os filtrados | um `runs/{id}/history.ndjson` por cenário, mais `runs/_suite/history.ndjson` e o `.gitattributes` | os históricos entram no commit da execução; o `.gitattributes` é versionado, e entra no commit seguinte que o alcançar |
| Apagar projeto | remove a pasta inteira | nada, o remoto continua onde está |
| Configurar a IA | SQLite em `<raiz>/runtime` | nada, é configuração do acutis e não do projeto |

O commit e o push acontecem na própria ação, com os arquivos que ela escreveu. O prefixo diz o que mudou: `test:` no que é teste (cenário e autenticação), `chore:` no que é configuração ou histórico. O desenho está no fluxo 27 de [SEQUENCE-DIAGRAMS](SEQUENCE-DIAGRAMS.md#27-o-commit-que-toda-ação-faz).
