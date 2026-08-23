---
name: run-e2e
description: Use when running, scoping or debugging the Playwright E2E suite in e2e/. Covers scoping by domain, the pretest build, the ports and the recorder window.
---

# Rodar a suíte E2E

Convenções de escrita dos testes ficam nas regras `.claude/rules/e2e*.md`, que carregam sozinhas ao mexer em `e2e/`. Subir a aplicação fora da suíte é a skill `run-local`.

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

`pnpm test` dentro de `e2e/` dispara `pretest`, que compila o recorder e a aplicação Nitro da raiz. `pnpm exec playwright test` **pula esse build** e roda contra o `.output` existente.

**How to apply:** editou `app/**`, `server/**` ou `core/**`? Rodar `pnpm build` antes de escopar com `pnpm exec` para não testar um bundle antigo.

**Why:** quatro testes de mudanças no frontend falharam em bloco, todos com "element(s) not found", como se o código não tivesse sido escrito. Estava escrito; o `preview` servia a build anterior. Falha em bloco logo depois de mexer no frontend = build velha, não regressão.

## Portas: E2E e dev convivem

O E2E sobe a aplicação Nitro na porta 4400, separada da porta de desenvolvimento 3000. **Não é preciso derrubar a aplicação local para rodar a suíte**.

Fonte única em `e2e/support/ports.ts`: mudar lá atualiza o Playwright, o starter e os scripts.

Ao checar porta ocupada, cuidado: `lsof -ti tcp:3000` também casa **conexões** do navegador, não só quem escuta. Para saber se há servidor de verdade: `lsof -nP -iTCP:3000 -sTCP:LISTEN`.

## O recorder abre janela

Por padrão o recorder sobe Chromium visível — gravar é alguém usando o sistema. Na suíte E2E isso já vem desligado (`RECORDER_HEADLESS=1` em `support/webdriver.ts`); para assistir a uma execução, `RECORDER_HEADLESS=0 pnpm test`.

Dirigindo a ferramenta de verdade (não a suíte), subir com `./dev.sh --headless` — senão cada gravação rouba o foco de quem está no micro.
