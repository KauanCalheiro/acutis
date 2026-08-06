# TODO

- [x] Docker para desenvolvimento local com hot-reload dos arquivos (backend, frontend, webdriver) — `docker compose -f docker-compose.dev.yml up`
- [x] Persistir as execuções de cenário e sincronizá-las pelo git
- [ ] Colocar config global ou de projeto para usar a IA, escolher seu provedor e chave de API, e modelo, vamos comecar consi
- [ ] Aposentar as modais de auth e reaproveitar a tela de cenário, vamos comecar considerando um modelo automatico mas vamos reescrever depois, podemos injetact via config o middleware
- [ ] Busca e paginação nas execuções do cenário
- [ ] Fluxo de fix deve rodar algumas vezes com a intencao de passar... (max_retries de 3)
- [ ] Estamos passando muita coisa direta para o modelo... precisamos passar de uma forma mais estruturada
- [ ] Vamos criar um agente para cada coisa AuthWritter, AuthFixer, AuthRevisor etc... e dar tool etc.. para garantir que os modelos vão conseguir acertar e melhorar a experiencia do usuario
- [x] Guardar as execuções de um cenário num arquivo só, não um por execução
- [x] Documentação de execução em `docs/`: [`RUN.md`](docs/RUN.md) indexando [`LOCAL.md`](docs/LOCAL.md), [`DOCKER.md`](docs/DOCKER.md) e [`TESTS.md`](docs/TESTS.md)

## Aposentar as modais de auth e reaproveitar a tela de cenário

O setup de autenticação já é um cenário (`Scenario::AUTH_ID`, com execução, histórico e vídeo iguais aos demais), mas tem uma interface paralela só dele em `project/auth/modal.vue` — ver, editar, regravar e pedir credenciais, tudo em modal. A tela de cenário (`projects/[projectSlug]/scenarios/[...scenario].vue`) já faz quase tudo isso.

### Escopo levantado até agora

- **Botão de regravação** na tela de cenário, que hoje só existe na modal.
- **Tirar uma tab**: o auth não tem Gherkin, então das três (`Eventos`, `Gherkin`, `Playwright`) sobram duas quando o cenário é o de autenticação.
- **O resto é a levantar** — pedido de credenciais, estado `skipped`/`failing` e os atalhos que hoje saem da modal ainda não têm destino definido na tela.

## Guardar as execuções num arquivo só

Cada execução era um arquivo em `runs/<cenário>/<timestamp>-<id>.json` e a pasta crescia sem limite. Agora o histórico é `runs/<cenário>/history.ndjson`, uma execução por linha, e o diff do git mostra só a linha nova.

### Como ficou

- **Formato.** NDJSON, append (`Runs::append()`), da mais antiga para a mais recente no arquivo; a leitura (`Runs::all()`) devolve ao contrário, mais recente primeiro.
- **Limite.** `Runs::KEPT = 20`; ao passar disso o arquivo é reescrito só com as 20 últimas. A API continua mostrando `Runs::SHOWN = 6`.
- **Migração.** Nenhuma — as pastas antigas dos projetos existentes ficam ignoradas e podem ser apagadas à mão (`.acutis/*/runs/*/[0-9]*.json`).
- **`last.webm`.** Segue arquivo solto ao lado do `history.ndjson`, sem mudança.

## Busca e paginação nas execuções

A seção Testes da tela de cenário mostra as execuções que a API devolve (`Runs::SHOWN = 6`) numa lista solta, sem filtro nem navegação — o arquivo já guarda 20 (`Runs::KEPT`), então metade do histórico não tem como ser vista pela interface.

### Pontos a resolver

- **Onde pagina.** No backend, com a API aceitando página/tamanho como os outros recursos, ou no frontend sobre o que já vem — o arquivo é pequeno e cabe inteiro numa resposta.
- **O que a busca filtra.** Data, status, branch, autor, ou o texto do step que falhou. Filtrar por status e por step falho é o que serve pra caçar regressão.
- **Relação com o limite.** Paginar além de 20 exige guardar mais, então esta decisão e o `Runs::KEPT` andam juntas.
