# Acutis — TCC (Versão Final)

Esta é a versão final do TCC. A versão inicial (com erros e código legado) está preservada em `../legacy-tcc/`.

## Começar

**Para usar:** baixe o instalador do seu sistema em
[Releases](https://github.com/KauanCalheiro/acutis/releases/latest) — ver [INSTALL.md](docs/INSTALL.md).
Não precisa de PHP, Node nem Playwright: tudo vai dentro.

**Para desenvolver:**

```sh
docker compose -f docker-compose.dev.yml up   # frontend :23000 · webdriver :24000 · backend :28000
```

Para gravar cenários é preciso um Chrome do host com a porta de debug aberta — e, no Linux nativo, um override no compose. Os detalhes estão em [DOCKER.md](docs/DOCKER.md).

## Documentação

- [Rodar o Acutis](docs/RUN.md) — índice dos modos de execução
  - [Instalar](docs/INSTALL.md) — o aplicativo pronto, por sistema (macOS, Windows, Ubuntu)
  - [Local](docs/LOCAL.md) — a stack como processos diretos no host
  - [Docker](docs/DOCKER.md) — a stack em containers, incluindo a gravação via CDP
  - [Desktop](docs/DESKTOP.md) — construir o instalador, com pré-requisitos por sistema
  - [Release](docs/RELEASE.md) — publicar os instaladores no GitHub
  - [Testes](docs/TESTS.md) — as quatro suítes (backend, frontend, webdriver, e2e) e suas peculiaridades

O atrito de abrir o Chrome na mão ([#56](https://github.com/KauanCalheiro/acutis/issues/56)) só
existe no Docker. No aplicativo empacotado o gravador abre o próprio Chromium, que vai dentro do
instalador.
