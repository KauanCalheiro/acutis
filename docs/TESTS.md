# Testes

## Vitest

Toda a cobertura da interface, dos handlers Nitro e do núcleo roda no pacote da raiz:

```sh
pnpm test
pnpm test:coverage
```

Os testes de endpoint usam um app H3 em memória e um diretório de projetos isolado. Eles não sobem Nest nem abrem navegador. Os testes da pill usam jsdom.

## E2E Playwright

```sh
pnpm test:e2e
```

O `pretest` compila o recorder e o Nitro. Cada grupo que precisa do app sobe `.output/server/index.mjs` na porta 4400 com raiz temporária. O recorder roda headless por padrão; use `RECORDER_HEADLESS=0` para acompanhar uma janela.

## Verificações antes de entregar

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
