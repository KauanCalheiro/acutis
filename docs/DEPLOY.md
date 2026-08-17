# Publicar o acutis

O acutis roda na máquina de quem o usa: ele abre um navegador, grava o que a pessoa faz e executa
Playwright no disco dela. Não existe "subir num servidor" — o que existe é **distribuir**, e há dois
canais.

| Canal | Comando de quem instala | Precisa de quê na máquina |
|---|---|---|
| **npm** (este documento) | `npx @acutis/backend` | Node 22+ |
| **Instalador desktop** | baixar o `.dmg`/`.exe`/`.AppImage` da release | nada |

O instalador vive nas branches `feat/empacotamento-desktop` (Tauri) e
`feat/empacotamento-desktop-electron`, com o processo em `docs/RELEASE.md` de cada uma. Elas ainda
não acompanharam a estrutura atual do backend e precisam ser reconciliadas antes da próxima release.

## Sumário

- [O que vai no pacote](#o-que-vai-no-pacote)
- [Publicar](#publicar)
- [Testar antes de publicar](#testar-antes-de-publicar)
- [Peculiaridades](#peculiaridades)

## O que vai no pacote

O pacote é o `backend/`, publicado como **`@acutis/backend`** — o nome do pacote no workspace. O nome
sem escopo `acutis` está tomado por um projeto abandonado de 2023; o escopo contorna isso e alinha os
quatro pacotes do repositório sob o mesmo prefixo.

> **Antes da primeira publicação:** o escopo `@acutis` precisa existir na conta do npm, e pacote
> escopado nasce privado — a primeira publicação exige `npm publish --access public`. Se o nome de
> instalação (`npx @acutis/backend`) incomodar na hora de divulgar, trocar o `name` para
> `@acutis/cli` é uma linha; o binário continua se chamando `acutis` de qualquer forma.

Ele carrega:

| O quê | De onde vem |
|---|---|
| `dist/` | `tsc` — a API, o gravador e o runner |
| `dist-ui/` | `vite` — a pílula que o gravador injeta na página |
| `frontend/` | o `.output` do Nuxt, copiado por `scripts/bundle-frontend.js` |
| `stubs/` | o `playwright.config.ts` e o `package.json` que todo projeto novo recebe |
| `reporters/stream-reporter.cjs` | o reporter que transmite a execução ao vivo |
| `bin/acutis.js` | o comando |

19,4 MB descompactado, 4,9 MB no `.tgz`. O Chromium fica **fora**: são ~150 MB que o npm baixaria em
toda instalação, e o `bin` o busca na primeira execução, no cache compartilhado do Playwright.

## Publicar

```sh
npm login                              # uma vez por máquina

cd backend
# tire a linha "private": true do package.json — é o pino de segurança
npm publish --access public            # `--access public` só é obrigatório na primeira vez
```

O `prepack` compila tudo antes de empacotar (frontend, `dist-ui`, `dist`), então não há como
publicar um pacote com o frontend velho dentro. Publicado, qualquer um roda:

```sh
npx @acutis/backend
```

Para uma versão nova: `npm version patch|minor|major` (cria o commit e a tag) e `npm publish` de
novo. O npm recusa republicar a mesma versão.

## Testar antes de publicar

Vale a pena sempre — é o que pegou o `stubs/` faltando no `files`, que fazia criar projeto responder
500 só no pacote:

```sh
cd backend
npm pack                                    # gera acutis-backend-<versão>.tgz

mkdir /tmp/teste && cd /tmp/teste
npm init -y
npm install /caminho/para/acutis-backend-1.0.0.tgz
./node_modules/.bin/acutis
```

Instalar num diretório limpo é o que revela arquivo que só existe no seu repositório. Depois, olhe
`~/.acutis/runtime/logs/requests-<dia>.jsonl`:

```sh
jq 'select(.status >= 500) | {url, error}' requests-*.jsonl
```

## Peculiaridades

- **`private: true` é intencional.** Enquanto estiver no `package.json`, o `npm publish` recusa e o
  `npm pack` continua funcionando. Tirá-la é o ato deliberado de publicar.
- **As portas não são fixas.** O `bin` pede porta 0 ao sistema para a API e para a interface, então
  duas instâncias convivem e a stack de desenvolvimento não atrapalha.
- **`WEBDRIVER_TEST_MODE=1` é setado pelo `bin`.** Sem ela o `/runner/video` responde 403 e o vídeo
  da execução que falhou não abre.
- **O pacote é publicado do `backend/`, não da raiz.** O `repository.directory` no `package.json`
  aponta isso para quem chegar pelo npm.
- **`@acutis/contracts` é `devDependency` do backend, de propósito.** Todo import dele aqui é
  `import type`: some na compilação, e nada em `dist/` o referencia (`grep -r @acutis/contracts
  backend/dist` não acha nada). Em `dependencies` ele entraria no pacote publicado como
  `"workspace:*"` — que o `npm install` de quem instalasse o CLI não sabe resolver. No frontend é o
  contrário: lá os schemas zod são usados em runtime, então é dependência de verdade (e o `.output`
  do Nuxt embute o código).
- **Não há CI de publicação ainda.** O passo é manual; automatizar por tag é o que falta da Fase 6.
