# TODO

- [x] Docker para desenvolvimento local com hot-reload dos arquivos (backend, frontend, webdriver) — `docker compose -f docker-compose.dev.yml up`
- [x] Persistir as execuções de cenário e sincronizá-las pelo git
- [ ] Identificar cenário flaky a partir do histórico de execuções
- [ ] Aposentar as modais de auth e reaproveitar a tela de cenário
- [ ] Guardar as execuções de um cenário num arquivo só, não um por execução
- [x] Documentação de execução em `docs/`: [`RUN.md`](docs/RUN.md) indexando [`LOCAL.md`](docs/LOCAL.md), [`DOCKER.md`](docs/DOCKER.md) e [`TESTS.md`](docs/TESTS.md)

## Aposentar as modais de auth e reaproveitar a tela de cenário

O setup de autenticação já é um cenário (`Scenario::AUTH_ID`, com execução, histórico e vídeo iguais aos demais), mas tem uma interface paralela só dele em `project/auth/modal.vue` — ver, editar, regravar e pedir credenciais, tudo em modal. A tela de cenário (`projects/[projectSlug]/scenarios/[...scenario].vue`) já faz quase tudo isso.

### Escopo levantado até agora

- **Botão de regravação** na tela de cenário, que hoje só existe na modal.
- **Tirar uma tab**: o auth não tem Gherkin, então das três (`Eventos`, `Gherkin`, `Playwright`) sobram duas quando o cenário é o de autenticação.
- **O resto é a levantar** — pedido de credenciais, estado `skipped`/`failing` e os atalhos que hoje saem da modal ainda não têm destino definido na tela.

## Guardar as execuções num arquivo só

Hoje cada execução vira um arquivo em `runs/<cenário>/<timestamp>-<id>.json`, e a pasta cresce sem limite — o projeto `plataforma` já tem 15 arquivos só em `runs/auth/`. Passar para um arquivo único por cenário (histórico como lista dentro dele) reduz o ruído no diff do git, que é por onde o histórico é sincronizado.

### Pontos a resolver

- **Formato.** Lista dentro de um JSON, ou NDJSON com uma execução por linha (append barato, diff limpo, sem reescrever o arquivo inteiro a cada run).
- **Limite.** Quantas execuções manter — a API já devolve 20; guardar tudo pra sempre reproduz o problema em outra forma.
- **Migração.** Os projetos existentes já têm as pastas antigas; converter na leitura ou num comando dedicado.
- **`last.webm`.** O vídeo continua sendo arquivo solto por cenário, então a mudança é só do JSON.

## Identificar cenário flaky

Com o histórico em `runs/<cenário>/` cada execução guarda status, steps e o código que rodou. Um cenário que alterna sucesso e falha **sem o `playwright` mudar entre as execuções** é flaky — o teste é instável, não o sistema testado. Quando o código mudou junto, é regressão ou correção, não instabilidade.

### Pontos a resolver

- **Critério.** Quantas execuções olhar (as 20 que a API já devolve?) e a partir de quantas alternâncias marcar como flaky. Uma falha isolada no meio de sucessos não é o mesmo que alternar a cada execução.
- **Step culpado.** O step que falha nas execuções instáveis costuma ser sempre o mesmo — apontá-lo vale mais que marcar o cenário inteiro.
- **Onde aparece.** Badge no card do cenário na listagem do projeto, ou na própria seção Testes da página do cenário.
- **Ação.** Só sinalizar, ou oferecer a correção por IA que já existe (`SpecFixer`) alimentada com as execuções que falharam?
