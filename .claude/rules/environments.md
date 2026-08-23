---
paths:
  - "core/modules/environment/**"
  - "core/use-cases/environment/**"
  - "core/modules/project/**"
  - "core/config/env.ts"
---

Cada projeto testado tem N ambientes em `environments/<slug>.json`. **Nenhum deles vai para o git**, porque `environments` está no `.gitignore` que o acutis garante.

```json
{ "name": "Homologação", "vars": [
    { "key": "URL",      "value": "https://homolog.acme.com" },
    { "key": "AUTH_USER",     "value": "qa@acme.com" },
    { "key": "AUTH_PASSWORD", "value": "senha-de-homolog", "secret": true } ] }
```

| Onde | O quê |
|------|-------|
| `environments/<slug>.json` | nome e variáveis daquele ambiente, com valor real |
| `.env` | `ENVIRONMENT` (ambiente ativo) e, em projeto sem ambiente nenhum, os valores soltos |
| `.env.example` | espelho de chaves; serve de autocomplete |

As chaves que o acutis conhece estão no enum `EnvKey`: `URL`, `AUTH_USER`, `AUTH_PASSWORD` e `ENVIRONMENT`. **Nunca escrever o nome da chave literal** — nem em código, nem em teste, nem em prompt de agente: sempre `EnvKey::X->value`, senão um rename futuro vira caça a string. `AUTH_USER`/`AUTH_PASSWORD` têm prefixo porque `USER` puro colide com a variável do shell, e o teste receberia o usuário da máquina em vez de falhar por credencial faltando.

## Invariantes

- **`secret` é só máscara de tela.** Não muda onde o valor é guardado: não existe ponteiro, cofre nem chave cunhada. O campo vira `type=password` com botão de revelar.
- **A chave é estrutura compartilhada.** Toda variável existe em todos os ambientes, com o mesmo flag de segredo; só o valor muda. Salvar um ambiente manda no conjunto de chaves dos demais (`Environments::alignTo`), e ambiente novo nasce com as chaves já declaradas.
- Cada ambiente tem **seu próprio valor** para a mesma chave; é o que separa staging de produção.
- `ENVIRONMENT` vazio ou apontando pra ambiente inexistente vale o primeiro da lista, em ordem alfabética por slug.
- Projeto sem nenhum ambiente se comporta como antes deles existirem: tudo direto no `.env`, que também é a camada base da resolução.
- Cada ambiente tem sua sessão. `STORAGE_STATE=storage-state.<slug>.json` entra no ambiente resolvido, e o `playwright.config.ts` cai em `storage-state.json` quando a variável não existe. **Ninguém monta esse nome à mão** — quem precisa do arquivo (gravação autenticada, recorder) lê `storage_state` do `GET /projects/{slug}`, que vem de `Environments::storageState()`. Já quebrou: o front pedia `storage-state.json` fixo enquanto o setup gravava em `storage-state.ambiente.json`, e o recorder abria deslogado sem erro nenhum.- Chave que a IA declara ao gerar cenário entra no **ambiente ativo**, não no `.env`.
- O prompt do `PlaywrightWriter` recebe as variáveis do ambiente ativo para o agente usar `process.env.CHAVE` em vez de literal. **Variável marcada como segredo entra só pelo nome**, nunca com o valor.

**How to apply:** ao ler ou escrever variável do projeto testado, passar por `Project::environments()` (`value`, `set`, `merge`, `resolve`), não por `Project::env()` direto. Este último só cuida do `ENVIRONMENT` e do projeto sem ambiente.
