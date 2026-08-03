# TODO

- [x] Docker para desenvolvimento local com hot-reload dos arquivos (backend, frontend, webdriver) — `docker compose -f docker-compose.dev.yml up`
- [x] Persistir as execuções de cenário e sincronizá-las pelo git
- [ ] Identificar cenário flaky a partir do histórico de execuções
- [x] Documentação de execução em `docs/`: [`RUN.md`](docs/RUN.md) indexando [`LOCAL.md`](docs/LOCAL.md), [`DOCKER.md`](docs/DOCKER.md) e [`TESTS.md`](docs/TESTS.md)

## Identificar cenário flaky

Com o histórico em `runs/<cenário>/` cada execução guarda status, steps e o código que rodou. Um cenário que alterna sucesso e falha **sem o `playwright` mudar entre as execuções** é flaky — o teste é instável, não o sistema testado. Quando o código mudou junto, é regressão ou correção, não instabilidade.

### Pontos a resolver

- **Critério.** Quantas execuções olhar (as 20 que a API já devolve?) e a partir de quantas alternâncias marcar como flaky. Uma falha isolada no meio de sucessos não é o mesmo que alternar a cada execução.
- **Step culpado.** O step que falha nas execuções instáveis costuma ser sempre o mesmo — apontá-lo vale mais que marcar o cenário inteiro.
- **Onde aparece.** Badge no card do cenário na listagem do projeto, ou na própria seção Testes da página do cenário.
- **Ação.** Só sinalizar, ou oferecer a correção por IA que já existe (`SpecFixer`) alimentada com as execuções que falharam?
