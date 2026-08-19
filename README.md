# Acutis: TCC (Versão Final)

Esta é a versão final do TCC. A versão inicial (com erros e código legado) está preservada em `../legacy-tcc/`.

## Começar

```sh
pnpm install   # uma vez, na raiz
./dev.sh       # interface + API + gravador + runner em :3000
```

Precisa de Node 22+ e pnpm no `PATH`. O gravador baixa o Chromium compatível automaticamente na primeira execução.

## Documentação

- [Rodar o Acutis](docs/RUN.md): como subir a aplicação
  - [Local](docs/LOCAL.md): o processo Nitro direto no host
  - [Testes](docs/TESTS.md): testes unitários, de integração e E2E
  - [Publicar](docs/DEPLOY.md): distribuir o CLI pelo npm
