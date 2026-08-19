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
npm exec --package ./acutis-cli-1.0.0-beta.1.tgz acutis
```

O CLI escolhe uma porta livre, garante o Chromium do Playwright, inicia um único processo Nitro e abre a interface. `Ctrl+C` encerra o processo inteiro.

## Publicar o beta

O passo a passo completo, incluindo preparação da branch, avisos esperados e diagnóstico de erros, está em [Publicação beta do CLI](BETA.md).

O manifesto fixa o dist-tag `beta`, então a publicação não altera `latest`:

```sh
npm login
npm whoami
pnpm release:beta
```

Cada nova publicação precisa de uma versão inédita. Para avançar de `beta.1` para `beta.2`:

```sh
pnpm version prerelease --preid beta --no-git-tag-version
pnpm release:beta
```

Depois da publicação, qualquer pessoa pode iniciar essa versão com:

```sh
pnpm dlx @acutis/cli@beta
```
