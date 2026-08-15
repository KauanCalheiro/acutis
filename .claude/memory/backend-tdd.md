---
name: backend-tdd
description: Testar a API — spec Vitest em __tests__/ ANTES do código, `// @vitest-environment node`, harness startApi com raiz de projetos temporária
metadata:
  type: feedback
---

Especificações de stack para TDD no backend. Convenções universais em [tdd](tdd.md).

## Setup

- Framework: **Vitest** (`backend/vitest.config.ts`).
- O spec fica em `__tests__/` **dentro do módulo que ele cobre** (`src/modules/project/__tests__/project-list.spec.ts`).
- O ambiente padrão é jsdom (por causa da pill), então todo spec de servidor abre com `// @vitest-environment node` na primeira linha.
- Rodar: `pnpm test` · um arquivo: `pnpm test <trecho-do-nome>`.

## Harness

`startApi()` (de `test/support/harness.ts`) sobe a API de verdade com uma raiz de projetos temporária e devolve `{ root, http, projectPath, close }`. `http` é supertest.

```ts
let api: Harness

beforeEach(async () => { api = await startApi() })
afterEach(async () => { await api.close() })

it('lista os projetos do diretório', async () => {
    const response = await api.http.get('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
})
```

- Módulo ainda não integrado ao `ApiModule`: `startApi([MeuModule])`.
- Dependência que subiria navegador ou chamaria modelo entra por override: `startApi([], [{ provide: RunnerService, value: duble }])`.
- Fixtures de evento/seletor em `test/support/fixtures.ts` — nunca repetir o objeto inteiro em cada teste.

## Cobertura obrigatória por recurso

| Cenário | O que verificar |
|---------|----------------|
| `index` | `{ data, meta }`, contagem e `meta.total` |
| `index` paginação | `page[size]`/`page[number]` e `meta.current_page` |
| `index` filtro/busca | devolve só o registro certo, case-insensitive |
| `show` | os campos do response |
| `show` inexistente | 404 |
| `store` | 201 + o efeito em disco (arquivo/diretório criado) |
| `store` validação | 422 + a mensagem em `errors` |
| `update` | 200 + o efeito em disco |
| `destroy` | 204 + o que saiu do disco junto |

## Gotchas

- O teste afirma o **efeito em disco**, não a chamada interna: leia o arquivo com `readFileSync` e confira o conteúdo.
- Nada de rede: repositório git de teste é um repo local criado com `execFileSync('git', ...)`, e provedor de IA entra como dublê.
- O `whitelist` do ValidationPipe apaga campo não declarado — teste que manda campo extra e espera vê-lo de volta falha por isso, não por bug do service.
