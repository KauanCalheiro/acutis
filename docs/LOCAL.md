# Desenvolvimento local

## Pré-requisitos

- Node 22 ou mais recente
- pnpm 11
- Git

## Subir

```sh
pnpm install
./dev.sh
```

A primeira execução baixa automaticamente o Chromium compatível com a versão instalada do Playwright. As próximas reutilizam o navegador guardado no cache da máquina.

A aplicação fica em `http://localhost:3000`. O processo inclui interface, API, gravador e runner. O Nuxt recarrega as alterações durante o desenvolvimento.

Para impedir que o recorder abra uma janela:

```sh
./dev.sh --headless
```

O SQLite das configurações nasce automaticamente dentro da raiz configurada por `ACUTIS_PROJECTS_PATH`. Sem essa variável, os projetos ficam em `~/.acutis`.

## Comandos diretos

```sh
pnpm dev
pnpm build
pnpm preview
```

Os endpoints de runner e debug ficam disponíveis porque o Acutis opera como uma aplicação local confiável. O pacote publicado limita o servidor a `127.0.0.1`.
