---
name: extension-tdd
description: Testar a extensão Chrome — escrever o teste ANTES de implementar; Vitest para lógica pura, Playwright para E2E real
metadata:
  type: feedback
---

Convenções universais de TDD em [[tdd]]. Nunca implementar a extensão sem teste antes — sem exceção.

**Why:** ao portar a captura de vídeo do legado (`../legacy-tcc`), o bug real (handshake do offscreen document travando numa segunda gravação, porque `OFFSCREEN_READY` só é emitido uma vez) só apareceu ao se escrever o teste da lógica de coordenação antes de implementar. Sem o teste, o bug teria sido copiado de novo do legado.

## Setup

- Unit: Vitest + jsdom → `pnpm test` (`extension/vite.config.ts`, `test.include: ['src/**/*.spec.ts']`)
- E2E: Playwright, extensão real carregada no Chromium via `launchPersistentContext` → `pnpm test:e2e` (builda antes)
- Setup de polyfills de API do browser que o jsdom não implementa (ex. `CSS.escape`) fica em `src/test-setup.ts`

## Ciclo

1. Escrever o teste (`*.spec.ts` ao lado do arquivo, em `src/`) — deve falhar **(red)**
2. Implementar o mínimo para passar **(green)**
3. Refatorar sem quebrar

## O que testar onde

- Lógica pura (composables, coordenadores de estado, seletores) → Vitest, sem mockar `chrome.*` quando dá pra extrair a lógica sem depender da API do browser
- Fluxo que depende de `chrome.*`/DOM real (mensageria entre background/content script/offscreen, manifest, permissões) → Playwright E2E carregando a extensão de verdade, não mock
