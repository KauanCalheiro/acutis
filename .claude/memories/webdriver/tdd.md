---
name: webdriver-tdd
description: Testar o webdriver — escrever o teste ANTES de implementar; Vitest para UI/pill, Playwright E2E real (sem extensão de navegador)
metadata:
  type: feedback
---

Convenções universais de TDD em [[tdd]]. Nunca implementar o webdriver sem teste antes — sem exceção.

**Why:** o webdriver substitui a extensão Chrome (removida) por Playwright controlando o navegador direto — `recordVideo`/`page.screencast` gravam sem pedir permissão nenhuma (canal de automação, não API web), e a UI/pill é injetada via `context.addInitScript`. Dois bugs reais só apareceram escrevendo o teste E2E de ponta a ponta antes de considerar terminado: (1) `page.goto('about:blank')` redundante no `start()` corria contra a navegação real disparada pelo teste — duas navegações concorrentes na mesma página; (2) `this.page` ficava setado antes de `exposeFunction`/`addInitScript` terminarem, deixando uma janela de corrida onde o teste podia navegar antes do script estar de fato registrado. Os dois só ficaram visíveis rodando a suíte várias vezes seguidas, não numa única execução.

## Setup

- Unit (UI/pill): Vitest + jsdom → `pnpm test` (`webdriver/vite.ui.config.ts`, `test.include: ['src/ui/**/*.spec.ts']`)
- Typecheck do server (NestJS): `pnpm typecheck` — Typecheck da UI: `pnpm typecheck:ui`
- E2E: Playwright na pasta raiz `e2e/`, sobe o webdriver real como processo filho (`WEBDRIVER_TEST_MODE=1`) e usa os endpoints `/debug/goto` e `/debug/click` pra dirigir a página gravada — nunca uma segunda conexão CDP separada pro mesmo navegador (duas sessões CDP brigando pelo mesmo alvo já causou fechamento de página em teste real)

## Ciclo

1. Escrever o teste — deve falhar **(red)**
2. Implementar o mínimo para passar **(green)**
3. Refatorar sem quebrar
4. **Rodar a suíte várias vezes seguidas antes de considerar terminado** — corrida de estado só aparece estatisticamente, não numa única rodada

## O que testar onde

- Lógica pura (composables da pill, seletores) → Vitest, sem mockar nada de navegador quando dá pra extrair a lógica sem depender de DOM/API real
- Fluxo que depende do Playwright real controlando o navegador (gateway WS, captura de vídeo, injeção da pill) → Playwright E2E subindo o webdriver de verdade, não mock
