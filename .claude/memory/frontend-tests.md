---
name: frontend-tests
description: Teste unitário do frontend (Vitest + @nuxt/test-utils) — armadilhas do mountSuspended, modal teleportado, tabs/select por $emit e o piso de cobertura
metadata:
  type: feedback
---

O frontend tem suíte unitária em `frontend/tests/` (Vitest, `environment: 'nuxt'`), além do E2E. Ela é o que sustenta o piso de cobertura do `pnpm test:coverage`. Convenções universais de TDD em [tdd](tdd.md).

**Why:** cada uma das armadilhas abaixo custou uma rodada de depuração; sem elas o teste falha por causa do ambiente, não do código.

## Como montar

- `mountSuspended(Componente, { props })` para componente sem `UTooltip`/`UPopover`/toast dentro.
- Componente que usa tooltip, popover ou toast precisa do `UApp` em volta: usar `mountInApp` de `tests/support/app.ts` — sem ele o mount quebra com `Injection Symbol(TooltipProviderContext) not found`.
- Modal com `v-model:open`: usar `openModal` de `tests/support/modal.ts`, que monta um pai de mentira e devolve `{ wrapper, state, events }`.
- Página: montar dentro do `UApp` e passar a rota (`mountSuspended(host, { route: '/projects/alpha-store?environment' })`).

## Armadilhas

- **O modal é teleportado para o `document.body`**: `wrapper.find` não o acha. Ler por `field('testid')` (query no body) e clicar no elemento do DOM. O conteúdo da página, ao contrário, só existe no wrapper.
- **Desmontar a página antes de limpar o body** quando o teste mexe em estado global (`useState`), senão o Vue do caso anterior repinta nós que não existem mais (`Cannot set properties of null (setting '__vnode')`).
- **`UTabs`, `USelect` e `USelectMenu` não reagem a clique no jsdom**: trocar o valor por `wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', valor)`, que é o mesmo caminho do `v-model` da tela.
- **`useWebdriver` já está conectado** quando a suíte sobe (o plugin `webdriver.client.ts` roda no boot do app de teste). Para observar a conexão do zero: `vi.stubGlobal('WebSocket', Fake)`, `vi.resetModules()` e reimportar o composable.
- **Relógio falso**: `settle()` de `tests/support/modal.ts` já adianta o timer falso; um `setTimeout` real dentro de `vi.useFakeTimers()` trava o teste.
- **`useFetch` guarda por chave**: dois casos que precisam de respostas diferentes usam slugs diferentes, ou `clearNuxtData()` no `beforeEach`.
- **`mockNuxtImport` é hoisted**: o dublê vem de `vi.hoisted`. Composable que devolve ref (ex.: `useAi().configured`) precisa de algo que o template desembrulhe — `{ __v_isRef: true, value }` resolve.
- **Não montar página em estado que a rota real nunca mostra** (projeto/cenário inexistente): o `createError` do setup não impede o Vue de renderizar, e o erro não tratado derruba o vitest. Esse caminho é do E2E.

## Cobertura

- Piso configurado nos dois pacotes: 95% de linhas/statements/funções e 90–92% de branches. Medido hoje: backend 98,9% e frontend 98,7%.
- Ficam **fora** da conta: `app/pages/dev/**` (bancada, 404 em produção), bootstrap (`main.ts`, `app.module.ts`, `src/scripts/**`), arquivos só de tipo e o que só existe com Playwright/socket real (`src/webdriver/recorder/**`, `gateway/**`, `runner.service.ts`) — a cobertura desses é o E2E, ver [webdriver-tdd](webdriver-tdd.md).
- `pnpm test:coverage` roda os dois pacotes **em sequência**: em paralelo, a máquina saturava e a suíte falhava de forma intermitente (socket hang up, 201 virando 200).
