---
name: publish
description: Publicar o CLI no npm — 2FA autorizado pelo navegador com `npm publish`, o `pnpm publish` não sabe fazer isso; workflow assume do segundo publish em diante
metadata:
  type: reference
---

O pacote é `@acutis/cli`, escopo da org `acutis` (conta `kauan_calheiro`, owner). O `publishConfig` fixa `access: public` e o dist-tag `latest`.

## Versão limpa, sem pré-lançamento

A numeração recomeçou em `0.0.0` (20/08/2026) e segue `0.1.0`, `0.1.1`, e assim por diante — semver simples no `latest`, sem `-beta.N`. As `1.0.0-beta.*` e `1.0.0-dev.*` foram despublicadas: 1.0.0 vinha antes de a ferramenta conseguir rodar um teste na máquina de quem instala, e número despublicado não volta.

Para trocar de numeração ou limpar versão antiga, **publicar a nova primeiro e só então despublicar as velhas**. Despublicar tudo antes deixa o nome bloqueado por 24h no npm, e nem a nova sobe. `tests/package.spec.ts` trava o formato da versão e o dist-tag.

## 2FA: usar `npm publish`, nunca `pnpm publish`

A conta tem 2FA em `auth-and-writes` e **não tem gerador de TOTP** — a chave foi salva no Bitwarden, mas geração de código é recurso Premium na conta individual, então não existe código de 6 dígitos para passar em `--otp`.

O `npm publish` resolve isso: ele imprime uma URL de autorização, você confirma no navegador já logado e o publish segue. O `pnpm publish` não tem esse fluxo — ele só sabe pedir OTP, e falha com `E403 Two-factor authentication ... is required`.

```sh
npm publish --access public
```

É o que o script `release` faz. Nunca chamar `pnpm publish` por baixo: cai no mesmo 403. Publicação manual é sempre pelo `npm`.

## Primeiro publish moveu o `latest`

O npm aponta `latest` para a primeira versão de um pacote, ignorando o `--tag`. Então `1.0.0-beta.1` ficou em `beta` **e** em `latest`, e o npm não permite remover a tag `latest`. Ela só sai de cima do beta quando uma versão sem sufixo for publicada.

## Do segundo publish em diante é o GitHub Actions

`.github/workflows/release.yml` publica por OIDC (trusted publishing), sem token no repositório:

- **git tag `v*`** publica a versão do `package.json`: pré-lançamento vai para `beta`, versão limpa para `latest`. Um passo aborta se a tag divergir da versão.
- **push na `main`** publica `1.0.0-dev.<run_number>` no dist-tag `dev`, descartável.

O trusted publisher já está configurado na página do pacote (`KauanCalheiro` / `acutis` / `release.yml`, sem environment), então o workflow publica sem token.

### O npm do runner precisa ser >= 11.5.1

Trusted publishing exige npm 11.5.1 ou mais novo. O runtime de Node do `pnpm/setup` entrega **npm 10.9.8**, que não tem o caminho de troca de token OIDC: o publish morre em `ENEEDAUTH` sem sequer imprimir uma linha de OIDC no log, como se faltasse login.

`npm install -g npm@latest` **não** resolve — instala o pacote, mas o runtime do pnpm mantém o próprio binário à frente no PATH e `npm -v` continua 10.9.8. A versão vem fixa pelo `npx`:

```sh
npx -y npm@11.19.0 publish --tag <tag> --access public
```

### Sem `--provenance` enquanto o repositório for privado

A atestação de proveniência vai para um log público de transparência e exige repositório público. O `acutis` é privado, então a flag falha. Se o repositório abrir, é só voltar com ela.

## O pacote instalado não é o repositório

Três coisas que valem no repo e não valem na máquina de quem instala, e que só aparecem testando o artefato:

- **`<pacote>/node_modules` só tem `.bin` e `.cache`.** npm e pnpm guardam as dependências na árvore de quem instalou. Caminho para dependência sai de `require.resolve('<dep>/package.json')`, nunca de `PACKAGE_ROOT/node_modules`.
- **Shim do `.bin` não sobrevive a symlink de diretório.** O do pnpm alcança o store por caminho relativo e estoura na raiz. Binário de dependência se chama por `spawn(process.execPath, [cliJs, ...])`, como `bin/ensure-chromium.js` faz.
- **Dentro do `.output`, o Nitro deixa stubs de uma linha no lugar das dependências externas.** `createRequire(import.meta.url)` de um chunk resolve o stub, não o pacote: a resolução precisa partir do manifesto da raiz (`createRequire(join(PACKAGE_ROOT, 'package.json'))`).
- **Uma execução, uma cópia do `@playwright/test`.** Duas e o Playwright para antes do primeiro teste: "did not expect test() to be called here". Por isso o runner não passa `NODE_PATH` (era a segunda fonte) e `borrowNodeModules` reaponta link do projeto que caia em outra árvore — o `node_modules` de um projeto que já rodou em modo dev aponta para o repositório.
- **`npx` e `pnpm dlx` cacheiam pela chave do especificador, não pela versão resolvida.** Rodar `@acutis/cli` de novo reaproveita o diretório antigo e nem baixa a versão nova. Para testar publicação recém-saída, usar a versão exata (`npx @acutis/cli@0.1.1`).
- **O comando que a documentação oferece é `npx`, e só ele.** O `pnpm dlx` para e pergunta antes de instalar, porque o pnpm bloqueia build de dependência não aprovada e o `better-sqlite3` traz um `binding.gyp` — build que ninguém precisa, já que o pacote vem com os `prebuilds` de todas as plataformas. Nenhum script de instalação pode voltar ao nosso manifesto: `nuxt prepare` é `prepare`, nunca `postinstall`, e `nuxt`, `@nuxt/ui`, `@iconify-json/*` e `@medv/finder` ficam em devDependencies, senão arrastam `esbuild` e `vue-demi` para a máquina de quem instala. `tests/package.spec.ts` trava as duas coisas.

Nada disso reproduz rodando do repositório. Antes de publicar mudança que toque em caminho ou dependência: `npm pack`, instalar o tarball num diretório limpo **fora do workspace** e exercitar o caminho de verdade.

Limpeza de versão `dev` é manual e sob demanda, nunca automatizada: `npm unpublish @acutis/cli@<versão>` funciona enquanto valerem as três condições do npm (mantenedor único, zero dependentes, menos de 300 downloads na semana), o que dispensa a janela de 72h. Versão despublicada não pode ser republicada com o mesmo número.
