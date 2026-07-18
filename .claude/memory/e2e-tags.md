---
name: e2e-tags
description: Tags de teste E2E (read/write+domínio, @manual) e padrão de steps em inglês imperativo
metadata:
  type: feedback
---

## Tags

Todo `test.describe` marca `tag`, sempre nessa ordem: `['@read'|'@write', '@dominio']`.

- `@read` — o teste só lê estado existente, não muda nada persistente
- `@write` — o teste cria/altera/apaga algo (gravação, registro, etc.)
- `@dominio` — a área testada (ex.: `@recording`, `@categoria`)

```ts
test.describe('recording playback', { tag: ['@read', '@recording'] }, () => { ... })
```

Permite filtrar (`playwright test --grep @write`) sem depender de convenção de nome de arquivo.

### `@manual`

Teste que precisa de interação humana real (algo que nenhuma API/flag simula) marca `@manual` **no teste**, além das tags do `describe`. A suíte padrão exclui `@manual` (`grepInvert: /@manual/` no config) — roda isolado via `pnpm test:e2e:manual`.

## Steps

`test.step(...)` em **inglês, imperativo direto** — sem cerimônia Gherkin (nada de "Given/When/Then"): `test.step('start recording', ...)`, `test.step('stop and upload video', ...)`.
