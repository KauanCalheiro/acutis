---
name: publish
description: Publicar o CLI no npm — 2FA autorizado pelo navegador com `npm publish`, o `pnpm publish` não sabe fazer isso; workflow assume do segundo publish em diante
metadata:
  type: reference
---

O pacote é `@acutis/cli`, escopo da org `acutis` (conta `kauan_calheiro`, owner). O `publishConfig` fixa `access: public` e o dist-tag `beta`.

## 2FA: usar `npm publish`, nunca `pnpm publish`

A conta tem 2FA em `auth-and-writes` e **não tem gerador de TOTP** — a chave foi salva no Bitwarden, mas geração de código é recurso Premium na conta individual, então não existe código de 6 dígitos para passar em `--otp`.

O `npm publish` resolve isso: ele imprime uma URL de autorização, você confirma no navegador já logado e o publish segue. O `pnpm publish` não tem esse fluxo — ele só sabe pedir OTP, e falha com `E403 Two-factor authentication ... is required`.

```sh
npm publish --tag beta --access public
```

Vale para o `pnpm release:beta` também: ele chama `pnpm publish` por baixo, então cai no mesmo 403. Publicação manual é sempre pelo `npm`.

## Primeiro publish moveu o `latest`

O npm aponta `latest` para a primeira versão de um pacote, ignorando o `--tag`. Então `1.0.0-beta.1` ficou em `beta` **e** em `latest`, e o npm não permite remover a tag `latest`. Ela só sai de cima do beta quando uma versão sem sufixo for publicada.

## Do segundo publish em diante é o GitHub Actions

`.github/workflows/release.yml` publica por OIDC (trusted publishing), sem token no repositório:

- **git tag `v*`** publica a versão do `package.json`: pré-lançamento vai para `beta`, versão limpa para `latest`. Um passo aborta se a tag divergir da versão.
- **push na `main`** publica `1.0.0-dev.<run_number>` no dist-tag `dev`, descartável.

O trusted publisher precisa estar configurado na página do pacote (Settings → Trusted publisher → repo e nome do workflow). Antes disso o workflow falha por falta de autenticação.

Limpeza de versão `dev` é manual e sob demanda, nunca automatizada: `npm unpublish @acutis/cli@<versão>` funciona enquanto valerem as três condições do npm (mantenedor único, zero dependentes, menos de 300 downloads na semana), o que dispensa a janela de 72h. Versão despublicada não pode ser republicada com o mesmo número.
