---
name: environments
description: Ambientes do projeto testado — environments/*.json versionado, .env como cofre; ler antes de mexer em variável, segredo ou sessão
metadata:
  type: reference
---

Cada projeto testado tem N ambientes em `environments/<slug>.json`, **versionados**. O `.env` do projeto é gitignorado e serve de cofre.

| Onde | O quê |
|------|-------|
| `environments/<slug>.json` | `{ name, vars: [{ key, value, secret }] }` — vai pro git |
| `.env` | valores reais, `ACUTIS_ENV` (ambiente ativo) e as chaves apontadas por segredo |
| `.env.example` | espelho só das chaves; `ACUTIS_ENV` fica de fora |

## Invariantes

- **Segredo nunca tem valor no arquivo versionado.** `secret: true` ⇒ `value` é sempre `{{env.CHAVE}}`. A conversão é da API (`Environments::secured`), não do cliente.
- **Valor de segredo nunca sai pela API**, em nenhuma tela.
- `ACUTIS_ENV` vazio ou apontando pra ambiente inexistente ⇒ vale o primeiro da lista (ordem alfabética por slug).
- Projeto sem nenhum ambiente se comporta como antes deles existirem: tudo direto no `.env`.
- Cada ambiente tem sua sessão — `STORAGE_STATE=storage-state.<slug>.json` entra no ambiente resolvido, e o `playwright.config.ts` cai em `storage-state.json` quando a variável não existe.

**How to apply:** ao ler ou escrever variável do projeto testado, passar por `Project::environments()` (`value`/`set`/`resolve`), não por `Project::env()` direto — só o `Env` e o editor do `.env` falam com o arquivo.
