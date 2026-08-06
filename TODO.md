# TODO

- [x] Docker para desenvolvimento local com hot-reload dos arquivos (backend, frontend, webdriver) — `docker compose -f docker-compose.dev.yml up`
- [x] Persistir as execuções de cenário e sincronizá-las pelo git
- [ ] Colocar config global ou de projeto para usar a IA, escolher seu provedor e chave de API, e modelo, vamos comecar consi
- [ ] Aposentar as modais de auth e reaproveitar a tela de cenário, vamos comecar considerando um modelo automatico mas vamos reescrever depois, podemos injetact via config o middleware
- [x] Busca e paginação nas execuções do cenário
- [ ] Levantar o teto do salto Nuxt para Laravel, hoje no default do undici
- [x] Fluxo de fix deve rodar algumas vezes com a intencao de passar... (`MAX_FIX_ATTEMPTS = 2`, ou seja até três passagens, nas três Actions que geram)
- [x] Estamos passando muita coisa direta para o modelo... precisamos passar de uma forma mais estruturada
- [x] Vamos criar um agente para cada coisa AuthWritter, AuthFixer, AuthRevisor etc... e dar tool etc.. para garantir que os modelos vão conseguir acertar e melhorar a experiencia do usuario
- [x] Mostrar os `warnings` da geração na interface
- [x] Guardar as execuções de um cenário num arquivo só, não um por execução
- [x] Documentação de execução em `docs/`: [`RUN.md`](docs/RUN.md) indexando [`LOCAL.md`](docs/LOCAL.md), [`DOCKER.md`](docs/DOCKER.md) e [`TESTS.md`](docs/TESTS.md)

## Mostrar os `warnings` da geração na interface

A geração devolvia `warnings` em `TestDraftResource` e `GeneratedAuthSetupResource` e nenhuma tela lia: o que o Fixer não resolve, como variável declarada sem valor, chegava na resposta HTTP e morria ali.

### Como ficou

- **Componente.** `components/scenario/warnings.vue`, um só para os dois pontos, e some sozinho quando não há ressalva.
- **Onde aparece.** No rascunho, acima dos contextos editáveis; e na tela de auth, ao lado do pedido de credencial.
- **Peso visual.** `UAlert` cor warning, uma linha por ressalva. O backend prefixa cada uma com o slug da regra (`env-sem-valor: ...`) e a tela mostra só a razão.
- **Ação.** Ressalva `env-sem-valor` oferece "Preencher ambiente", que leva para `/projects/{slug}?ambiente`. O `?ambiente` é novo e abre o modal de ambientes direto, ligando a flag no `onMounted` para o `watch(open)` do modal disparar na mudança e carregar os dados.
- **Preview.** `/dev/generation-warnings` renderiza os quatro estados com dado mocado.

Formato decidido com o usuário: a memória `frontend-feedback` manda retorno de interação ir para toast, e aqui o `UAlert` inline foi pedido explicitamente, porque toast some e a ressalva precisa continuar visível enquanto o spec é revisado.

## Buracos menores da refatoração dos agentes

- **Comentários inline pendentes**: 15 linhas `//` no `webdriver/src` (fora dos `.spec.ts`) e 16 no `frontend/app`. São explicações de "por quê" ancoradas em linha; empurrar quatro delas para o docblock de um mesmo método vira depósito, então pedem um passe pensado.

## Aposentar as modais de auth e reaproveitar a tela de cenário

O setup de autenticação já é um cenário (`Scenario::AUTH_ID`, com execução, histórico e vídeo iguais aos demais) e tinha uma interface paralela só dele em `project/auth/modal.vue`: ver, editar, regravar e pedir credenciais, tudo em modal. A tela de cenário (`projects/[projectSlug]/scenarios/[...scenario].vue`) assumiu quase tudo.

### O que já saiu

- **`project/auth/modal.vue` não existe mais**, e nada no código referencia a modal antiga.
- **Botão de regravação** na tela de cenário, `auth-gravar` ("Gravar novamente").
- **Pedido de credenciais** sobreviveu como `project/auth/credentials.vue`, aberto pela tela de cenário. É formulário, não interface paralela, então pode ficar.

A tab Gherkin fica: o login também vira `auth.feature`, escrito por `WriteAuthRecordingToProject`, então as três tabs valem para o cenário de autenticação como para qualquer outro.

### O que falta

- **Estado `skipped`/`failing`** e os atalhos que saíam da modal ainda não têm destino definido na tela. Hoje `auth_status` e o botão de pular vivem na tela do projeto (`[slug].vue`), e a tela de cenário não os oferece.

## Guardar as execuções num arquivo só

Cada execução era um arquivo em `runs/<cenário>/<timestamp>-<id>.json` e a pasta crescia sem limite. Agora o histórico é `runs/<cenário>/history.ndjson`, uma execução por linha, e o diff do git mostra só a linha nova.

### Como ficou

- **Formato.** NDJSON, append (`Runs::append()`), da mais antiga para a mais recente no arquivo; a leitura (`Runs::all()`) devolve ao contrário, mais recente primeiro.
- **Limite.** `Runs::KEPT = 20`; ao passar disso o arquivo é reescrito só com as 20 últimas. A API continua mostrando `Runs::SHOWN = 6`.
- **Migração.** Nenhuma — as pastas antigas dos projetos existentes ficam ignoradas e podem ser apagadas à mão (`.acutis/*/runs/*/[0-9]*.json`).
- **`last.webm`.** Segue arquivo solto ao lado do `history.ndjson`, sem mudança.

## Teto do salto Nuxt para Laravel

Os tetos de uma chamada de IA foram levantados: 500s no cliente HTTP do `laravel/ai` (`Limits::TIMEOUT`, por `#[Timeout]` nos nove agentes) e 600s de execução do PHP (`AppServiceProvider`). Sobrou um salto sem teto declarado: `frontend/server/utils/client.ts` cria o `ofetch` sem `timeout`, então vale o default do undici, tipicamente 300s de headers timeout.

### Pontos a resolver

- **Confirmar o número.** O default nunca foi medido aqui, só lido. Antes de mexer, provocar uma resposta lenta de propósito e ver onde ela morre.
- **Onde mexe.** O `timeout` do ofetch usa `AbortSignal` e não substitui o `headersTimeout` do undici; subir aquele limite pede um dispatcher próprio.
- **Se vale a pena.** A falha real que motivou os outros tetos levava 82s. Enquanto nenhuma geração passar de 300s, isto é teoria.

## Busca e paginação nas execuções

A seção Testes mostrava as execuções cortadas em `Runs::SHOWN = 6` numa lista solta, sem filtro nem navegação. O arquivo guarda `KEPT = 20`, então dois terços do histórico não tinham como ser vistos.

### Como ficou

- **Onde pagina.** No browser. `ListScenarioRuns` devolve o histórico inteiro, e a constante `SHOWN` saiu por virar código morto. São 20 itens vindos de um arquivo já lido inteiro, então página e filtro como query param não se pagariam.
- **O que a busca filtra.** Um campo de texto varrendo data, branch, autor e o título do step que falhou, mais um seletor de status.
- **Paginação.** 6 por página, a densidade que a seção já tinha.
- **Duração.** Entrou na linha da data, em texto apagado (`13/06/2026, 06:15 em 3,8s`). O dado vinha na resposta e nenhuma tela mostrava.
- **Filtro sem resultado.** Estado próprio, com texto diferente do "nenhum teste executado ainda", senão parece que o histórico sumiu.
- **Preview.** `/dev/scenario-runs`.
