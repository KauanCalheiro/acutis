# Acutis — TCC (Versão Final)

Esta é a versão final do TCC. A versão inicial (com erros e código legado) está preservada em `../legacy-tcc/`.

## Começar

```sh
pnpm install   # uma vez, na raiz — instala os quatro pacotes do workspace
./dev.sh       # frontend :3000 · backend :4000 (API + gravador + runner)
```

Precisa de Node 22+ e pnpm no `PATH`. O gravador abre o próprio Chromium — não há nada a instalar além disso.

## Documentação

- [Rodar o Acutis](docs/RUN.md) — como subir a stack
  - [Local](docs/LOCAL.md) — a stack como processos diretos no host
  - [Testes](docs/TESTS.md) — as quatro suítes (backend, frontend, webdriver, e2e) e suas peculiaridades
  - [Publicar](docs/DEPLOY.md) — distribuir o CLI pelo npm
