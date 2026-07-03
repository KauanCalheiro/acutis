---
name: e2e
description: Convenções de E2E (Playwright, pasta e2e/) — tags read/write+domínio, steps em inglês imperativo, seed só quando há dado do backend
metadata:
  type: feedback
---

Testes cross-tool (webdriver + frontend + backend) vivem em `e2e/` na raiz do monorepo. Convenções universais de TDD em [[tdd]]; testes de unidade de cada ferramenta ficam nas próprias pastas (`webdriver/src/ui/**/*.spec.ts` via Vitest, futuramente backend/frontend). Convenções específicas de teste do webdriver (evitar duas sessões CDP no mesmo navegador, endpoints de debug) em [[webdriver-tdd]].

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

Teste que precisa de interação humana real (algo que nenhuma API/flag consegue simular) marca `@manual` **no teste**, além das tags do `describe`:

```ts
test.describe('some flow', { tag: ['@write', '@recording'] }, () => {
    test('needs a real human step', { tag: ['@manual'] }, async () => { ... })
})
```

A suíte padrão exclui `@manual` por default (`grepInvert: /@manual/` no `playwright.config.ts`) — não trava esperando humano numa rodada automática. Roda isolado e sob aviso via script próprio (`pnpm test:e2e:manual` → `playwright test --grep @manual`).

## Steps

`test.step(...)` em **inglês, imperativo direto** — sem cerimônia Gherkin (nada de "Given/When/Then"):

```ts
await test.step('start recording', async () => { ... })
await test.step('stop and upload video', async () => { ... })
```

## Seed determinístico

Quando o teste depende de dado do **backend Laravel/DB**, usar um banco dedicado pro Playwright — nunca o `database.sqlite` de dev:

- `backend/database/e2e.sqlite` — arquivo SQLite isolado, só pra rodadas de E2E (gitignored)
- Antes da suíte rodar, resetar e semear: `DB_DATABASE=database/e2e.sqlite php artisan migrate:fresh --seed`
- O `php artisan serve` da suíte de E2E aponta pra esse mesmo `DB_DATABASE` — nunca o banco de dev, pra não sujar dado real nem depender do que já está lá
- Cada rodada começa do mesmo estado semeado — determinístico, sem depender de execução anterior

Testes que só envolvem extensão + arquivo local (ex.: vídeo/eventos de gravação) não têm banco envolvido — não se aplica.

## Organização de arquivo

Um arquivo de spec por domínio, mesmo que fique grande — não dividir os testes do mesmo domínio em vários arquivos só pra deixar menor. `test.describe` + tags já dão a organização interna necessária.

## Hidratação

Toda página Nuxt precisa hidratar no cliente antes que cliques/preenchimentos funcionem de verdade (o HTML do SSR já chega "parecendo" interativo, mas o listener do Vue só liga depois). Sempre esperar a página hidratar antes de interagir — mecanismo em [[e2e-setup]].
