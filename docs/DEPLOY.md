# Publicar o CLI

O pacote publicável é a raiz. Ela contém o servidor Nitro autocontido, o bundle injetável do recorder, os templates e o comando `acutis`.

## Gerar o pacote

```sh
pnpm cli:build
pnpm pack
```

O build produz:

- `.output/`: interface e servidor Nitro
- `dist-ui/driver-entry.js`: script injetado pelo gravador
- `bin/acutis.js`: entrada do CLI
- `reporters/stream-reporter.cjs`: reporter do runner
- `stubs/`: template de projeto

## Testar o tarball

```sh
npm exec --package ./acutis-1.0.0.tgz acutis
```

O CLI escolhe uma porta livre, garante o Chromium do Playwright, inicia um único processo Nitro e abre a interface. `Ctrl+C` encerra o processo inteiro.

O campo `private` do `package.json` continua sendo o pino de segurança. Remova-o somente no fluxo de publicação aprovado.
