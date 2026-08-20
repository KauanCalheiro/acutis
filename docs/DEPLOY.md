# Publicar o CLI

O pacote publicável é a raiz. Ela contém o servidor Nitro autocontido, o bundle injetável do recorder, os templates e o comando `acutis`.

## Gerar o pacote

```sh
npm pack
```

O `prepack` builda antes de empacotar, então não precisa de passo separado. O build produz:

- `.output/`: interface e servidor Nitro
- `dist-ui/driver-entry.js`: script injetado pelo gravador
- `bin/acutis.js`: entrada do CLI
- `reporters/stream-reporter.cjs`: reporter do runner
- `stubs/`: template de projeto

## Testar o tarball

Instale o tarball num diretório vazio **fora do workspace** e exercite o caminho de verdade — gravar ou executar um cenário:

```sh
mkdir /tmp/acutis-limpo && cd /tmp/acutis-limpo
npm init -y
npm install <caminho>/acutis-cli-0.1.0.tgz
./node_modules/.bin/acutis
```

O CLI escolhe uma porta livre, garante o Chromium do Playwright, inicia um único processo Nitro e abre a interface. `Ctrl+C` encerra o processo inteiro.

Rodar do repositório não substitui esse teste: o pacote instalado não guarda as próprias dependências, e caminho resolvido a partir do `.output` cai nos stubs que o Nitro deixa no lugar das dependências externas.

## Publicar

Quem publica é o GitHub Actions, por OIDC, sem token no repositório:

| Gatilho | Versão | Dist-tag |
|---------|--------|----------|
| tag `v<versão>` | a do `package.json`, que precisa casar com a tag | `latest`; pré-lançamento (com hífen) vai para `beta` |
| push na `main` | `<versão>-dev.<run>` | `dev`, descartável |

O fluxo de uma release:

```sh
npm version 0.1.1 --no-git-tag-version   # entra num commit chore: release
# abra o PR e faça o merge na main
git tag v0.1.1
git push origin v0.1.1
```

Versões seguem semver limpo — `0.1.0`, `0.1.1` — e `tests/package.spec.ts` recusa qualquer outro formato.

Depois da publicação, qualquer pessoa inicia a versão nova com:

```sh
npx @acutis/cli
```

`npx` não pede nada a quem instala, e é o único comando que a documentação oferece. Para conferir uma publicação recém-saída, peça a versão exata (`npx @acutis/cli@0.1.1`), que o cache guarda por especificador.

## Publicação manual

Só quando o Actions não serve. A conta tem 2FA sem gerador de TOTP, então o publish precisa ser o do npm, que autoriza pelo navegador — `pnpm publish` só sabe pedir código e falha com 403:

```sh
npm login
npm whoami
pnpm release
```
