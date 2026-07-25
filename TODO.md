# TODO

- [x] Docker para desenvolvimento local com hot-reload dos arquivos (backend, frontend, webdriver) — `docker compose -f docker-compose.dev.yml up`
- [ ] Persistir as execuções de cenário e sincronizá-las pelo git

## Persistir as execuções e sincronizar pelo git

Hoje a execução é efêmera: o `/runner/project/stream` emite os eventos, o modal mostra a timeline e o vídeo, e acabou. Fechou o modal, perdeu. Quem rodou o cenário ontem não tem como mostrar o resultado pra outra pessoa, e não existe histórico pra comparar duas execuções do mesmo cenário.

A ideia é gravar cada execução no próprio projeto e deixar o git ser o transporte — sem servidor de artefatos, sem storage externo. Quem dá `git pull` recebe as execuções dos outros junto com os testes.

### Pontos a resolver

- **Onde guardar.** Algo como `results/runs/<cenário>/<timestamp>/` com os eventos do stream em JSON, o status, a duração e o vídeo. O `.gitignore` que o `AuthProjectFiles::ensureGitignore` escreve hoje inclui `results` e `test-results` — precisa abrir exceção pro que for versionado.
- **Peso do vídeo.** É o problema central. Um `.webm` de 30s já passa de 1MB e o git não faz diff disso — cada execução vira um blob novo e o repositório cresce sem teto. Decidir entre: guardar só a última execução por cenário, guardar vídeo só de falha, usar Git LFS, ou não versionar vídeo nenhum e manter só a timeline (que é texto e diffa bem).
- **Sincronia.** "Mandar de forma síncrona pelo git" precisa virar um fluxo concreto: commit automático ao terminar a execução? Push? Em qual branch? Rodar teste não deveria sujar a branch de trabalho de quem executou.
- **Conflito.** Duas pessoas executando o mesmo cenário geram arquivos no mesmo caminho. Nome por timestamp mais autor evita colisão, mas multiplica os arquivos.
- **Leitura.** O backend passa a listar execuções do disco (como já faz com cenários em `ListProjectScenarios`) e a UI ganha um histórico por cenário, não só o modal da execução corrente.

### O que já existe pra reaproveitar

- Os eventos da timeline já são estruturados e chegam por NDJSON do `stream-reporter.cjs` — serializar é direto.
- O vídeo já é servido por caminho absoluto (`/runner/video?path=`), então apontar pra um arquivo versionado no projeto não muda o player.
- `Scenario::source()` já mostra que dá pra normalizar arquivo do projeto na leitura sem afetar a escrita.
