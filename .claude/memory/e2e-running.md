---
name: e2e-running
description: Como rodar a suíte E2E — por domínio via tag, o build que o pretest faz, e o conflito de porta com a stack local
metadata:
  type: feedback
---

Convenções das tags em [e2e-tags](e2e-tags.md); modos de execução da stack em [execution](execution.md).

## Rodar por domínio

```sh
cd e2e
pnpm test                                          # suíte inteira — e faz o build (ver abaixo)
pnpm exec playwright test --grep @project          # só um domínio
pnpm exec playwright test --grep "project settings" # só um describe
```

**`pnpm test -- --grep @project` NÃO funciona** — o `--` não repassa a flag nesta versão do pnpm, e o Playwright roda a suíte inteira **sem avisar**. Parece que filtrou (termina verde), mas custou minutos e não testou o que você pediu. Use `pnpm exec playwright test` quando quiser escopo.

**Why:** um filtro silenciosamente ignorado é pior que um erro — dá a impressão de que o escopo foi respeitado.

## O build está no `pretest`, não no `playwright test`

`pnpm test` dispara `pretest`: **build do frontend** + `build:ui` e `build` do backend, todos via `pnpm --filter`. `pnpm exec playwright test` **pula tudo isso** — e o `webServer` do Playwright é `pnpm preview`, que serve o `.output` da última build.

**How to apply:** editou `frontend/app/**` ou `backend/src/**`? Rodar o build daquele serviço (`pnpm --filter @acutis/frontend build`) antes de escopar com `pnpm exec` — senão os testes rodam contra um bundle velho e passam/falham por motivo errado. Mesma armadilha do `pnpm dev` não ser watch mode (ver [execution](execution.md)).

**Why:** quatro testes de mudanças no frontend falharam em bloco, todos com "element(s) not found", como se o código não tivesse sido escrito. Estava escrito; o `preview` servia a build anterior. Falha em bloco logo depois de mexer no frontend = build velha, não regressão.

## Portas: E2E e dev convivem

O E2E sobe os três serviços na faixa **42xx** (backend 4200, frontend 4300, webdriver 4400), separada das portas de desenvolvimento (8000/3000/4000). **Não é preciso derrubar a stack local para rodar a suíte** — verificado rodando as duas juntas.

Fonte única em `e2e/support/ports.ts`: mudar lá muda o Playwright, os dois starters e os scripts.

Ao checar porta ocupada, cuidado: `lsof -ti tcp:3000` também casa **conexões** do navegador, não só quem escuta. Para saber se há servidor de verdade: `lsof -nP -iTCP:3000 -sTCP:LISTEN`.

## O recorder abre janela

Por padrão o recorder sobe Chromium visível — gravar é alguém usando o sistema. Na suíte E2E isso já vem desligado (`RECORDER_HEADLESS=1` em `support/webdriver.ts`); para assistir a uma execução, `RECORDER_HEADLESS=0 pnpm test`.

Dirigindo a ferramenta de verdade (não a suíte), subir com `./dev.sh --headless` — senão cada gravação rouba o foco de quem está no micro.
