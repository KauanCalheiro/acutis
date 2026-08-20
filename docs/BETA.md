# Publicação beta do CLI

Este guia publica o CLI como `@acutis/cli` no dist-tag `beta`. A versão estável `latest` não é alterada.

## Pré-requisitos

- Conta npm pertencente à organização `@acutis`, com permissão de escrita.
- Autenticação em dois fatores habilitada para publicação direta.
- Node 22 ou mais recente e pnpm 11.
- Branch com todas as mudanças commitadas.

Confira o estado antes de começar:

```sh
git branch --show-current
git status --short
```

O segundo comando não deve listar arquivos. O pnpm bloqueia a publicação de uma árvore de trabalho suja para que cada pacote corresponda a um commit recuperável.

## Validar a versão

O `package.json` deve conter um nome e uma versão de pré-lançamento:

```json
{
  "name": "@acutis/cli",
  "version": "1.0.0-beta.1"
}
```

Cada publicação exige uma versão inédita. Para avançar para o próximo beta:

```sh
pnpm version prerelease --preid beta --no-git-tag-version
```

Esse comando altera o `package.json`. Valide e faça commit da nova versão antes de publicar.

## Rodar as verificações

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm cli:build
```

O build gera a interface, o servidor Nitro e o recorder que serão incluídos no pacote.

## Commitar a versão

```sh
git add .
git commit -m "chore: preparar beta do cli"
git status --short
```

O último comando deve continuar sem saída.

## Autenticar no npm

```sh
npm login
npm whoami
```

O usuário retornado precisa pertencer à organização `@acutis` e ter permissão para publicar `@acutis/cli`.

## Publicar

```sh
pnpm release:beta
```

Durante a publicação podem aparecer estas etapas:

1. O aviso de `publish-branch` informa que a branch atual não é `main` ou `master`. Confirme somente quando a publicação dessa branch for intencional.
2. A linha `$ pnpm build` é esperada. O script `prepack` recompila o pacote antes do envio.
3. O npm pode solicitar o código de autenticação em dois fatores.
4. O sucesso termina com uma linha semelhante a `+ @acutis/cli@1.0.0-beta.1`.

O `publishConfig` e o comando `release:beta` fixam o dist-tag `beta`, então esse fluxo não promove a versão para `latest`.

## Confirmar a publicação

```sh
npm view @acutis/cli version dist-tags
npm view @acutis/cli@beta version
```

Teste a mesma experiência entregue ao usuário:

```sh
pnpm dlx @acutis/cli@beta
```

O terminal deve mostrar um único endereço com o rótulo `aplicação`. O servidor fica restrito a `127.0.0.1` e `Ctrl+C` encerra o processo.

## Publicar o próximo beta

```sh
pnpm version prerelease --preid beta --no-git-tag-version
pnpm lint
pnpm typecheck
pnpm test
git add package.json
git commit -m "chore: preparar próximo beta do cli"
pnpm release:beta
```

Uma versão já publicada não pode ser sobrescrita. Se a publicação falhar depois de o npm aceitar a versão, avance para o próximo número beta antes de tentar novamente.

## Erros comuns

### `ERR_PNPM_GIT_UNCLEAN`

Existem arquivos modificados ou novos sem commit. Revise `git status --short`, faça o commit e execute novamente. Não use `--no-git-checks` no fluxo normal.

### Erro de permissão no escopo

Confirme que `npm whoami` mostra o usuário correto e que ele aparece nos membros da organização `@acutis` com permissão de escrita.

### Solicitação de 2FA

Informe o código atual do autenticador. Para automação futura, configure trusted publishing em vez de guardar um token amplo no repositório.
