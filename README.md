# Acutis — TCC (Versão Final)

Esta é a versão final do TCC. A versão inicial (com erros e código legado) está preservada em `../legacy-tcc/`.

## Começar

```sh
docker compose -f docker-compose.dev.yml up   # frontend :23000 · webdriver :24000 · backend :28000
```

Para gravar cenários é preciso um Chrome do host com a porta de debug aberta — e, no Linux nativo, um override no compose. Os detalhes estão em [DOCKER.md](docs/DOCKER.md).

## Documentação

- [Rodar o Acutis](docs/RUN.md) — índice dos modos de execução
  - [Local](docs/LOCAL.md) — a stack como processos diretos no host
  - [Docker](docs/DOCKER.md) — a stack em containers, incluindo a gravação via CDP
  - [Testes](docs/TESTS.md) — as quatro suítes (backend, frontend, webdriver, e2e) e suas peculiaridades

> **TODO ([#56](https://github.com/KauanCalheiro/acutis/issues/56)):** abrir o Chrome na mão é atrito de DX. O plano de longo prazo é empacotar o recorder para rodar no host (companion `acutis-recorder` ou app desktop Electron/Tauri embutindo frontend + webdriver), eliminando este passo. Pensar melhor na estratégia de empacotamento antes da release.
