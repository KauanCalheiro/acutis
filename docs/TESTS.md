# Testes

Como rodar cada suíte do monorepo na mão, e o que cada uma tem de peculiar.

## Sumário

- [Visão geral](#visão-geral)
- [Frontend (Vitest)](#frontend-vitest)
- [Backend (Vitest)](#backend-vitest)
- [E2E (Playwright)](#e2e-playwright)
- [Rodar tudo](#rodar-tudo)

## Visão geral

| Suíte | Ferramenta | Onde ficam os testes | Comando | Precisa da stack de pé? |
|-------|-----------|----------------------|---------|-------------------------|
| Frontend | Vitest + `@nuxt/test-utils` | `frontend/tests/` | `cd frontend && pnpm test` | não |
| Backend | Vitest | `backend/**/*.spec.ts` | `cd backend && pnpm test` | não |
| E2E | Playwright | `e2e/tests/` | `cd e2e && pnpm test` | não — a suíte sobe os dois serviços sozinha |

As duas primeiras são unitárias/de integração local: rodam em segundos, sem rede e sem serviço subindo. O E2E é o único caro (~2 min) e o único que exige as dependências do host instaladas (Node, pnpm).

## Frontend (Vitest)

```sh
cd frontend
pnpm test                                  # suíte inteira (vitest run)
pnpm vitest run tests/pages/index.spec.ts  # um arquivo
pnpm vitest                                # watch mode
```

### Peculiaridades

- **Ambiente é `nuxt`, não `jsdom` puro** (`frontend/vitest.config.ts` usa `defineVitestConfig`). Cada teste sobe um runtime Nuxt de verdade: auto-imports, composables e `~/` funcionam igual ao app, ao custo de ~5s de import na primeira execução.
- **Componente com `await` no `setup` precisa de `mountSuspended`**, não `mount`. É o caso da maioria das páginas (`useFetch`), e o erro quando se usa `mount` é confuso.
- **Chamada HTTP se intercepta com `registerEndpoint`**, não com mock de `$fetch` — ver `tests/pages/index.spec.ts`.
- **Asserção por texto quebra quando o texto é decorativo.** A home troca o tagline aleatoriamente e o card de projeto guarda a URL do repositório no atributo `title` (só o `path` é texto visível). Asserte em `data-testid`, atributo ou dado vindo da API — nunca em frase de UI que pode mudar.
- `pnpm lint` e `pnpm typecheck` são separados do `test` e não rodam junto.

## Backend (Vitest)

Gravador, runner e a API `/api/v1` (`src/modules`) — os três no mesmo processo desde a migração para Node.

```sh
cd backend
pnpm test                                  # suíte inteira
pnpm vitest run src/modules/project        # um módulo
```

### Peculiaridades

- **Os testes ficam em `__tests__/` dentro de cada pacote** (`src/modules/project/__tests__/`, `src/webdriver/pill/__tests__/`); o harness e os fixtures ficam em `test/`. Quem governa a suíte é `vitest.config.ts` — `vite.ui.config.ts` só faz o bundle da pill.
- Cobre a lógica isolada do recorder: máquina de estados da pill, captura de seletor, e o reporter de streaming. O comportamento do serviço NestJS de ponta a ponta é coberto pelo E2E, não aqui.
- **Nada aqui valida o bundle injetado.** Quem faz isso é `e2e/tests/webdriver-bundle.spec.ts`, e só depois do `build:ui`.

## E2E (Playwright)

```sh
cd e2e
pnpm test                                            # suíte inteira, com build + seed
pnpm exec playwright test --grep @project            # só um domínio
pnpm exec playwright test --grep "project settings"  # só um describe
pnpm exec playwright test tests/runner.spec.ts       # só um arquivo
pnpm exec playwright show-report                     # abre o relatório da última rodada
```

### Peculiaridades

- **`pnpm test -- --grep @project` NÃO filtra.** O `--` não repassa a flag nesta versão do pnpm e o Playwright roda a suíte inteira **sem avisar** — termina verde e parece que respeitou o escopo. Para escopar, use `pnpm exec playwright test`.
- **O build está no `pretest`, não no `playwright test`.** `pnpm test` dispara `scripts/setup.sh` (build do frontend) e o `build:ui` + `build` do backend. `pnpm exec playwright test` pula tudo isso. Editou `backend/src/**`? Rode `pnpm test` uma vez antes de escopar com `pnpm exec`, senão os testes rodam contra um bundle velho.
- **Estado dedicado.** Cada spec aponta o backend para um diretório de projetos temporário, e o SQLite das configurações é derivado dele — o seu `~/.acutis` não é tocado.
- **Portas 42xx, isoladas do desenvolvimento** (frontend 4300, backend 4400 — fonte única em `e2e/support/ports.ts`). Não é preciso derrubar a stack local para rodar a suíte. Ao checar porta ocupada, use `lsof -nP -iTCP:4300 -sTCP:LISTEN`: sem o `-sTCP:LISTEN`, o `lsof` também casa conexões do navegador e você conclui errado que há servidor de pé.
- **Só o frontend sobe pelo `webServer` do Playwright.** O backend sobe de dentro dos próprios specs (`support/backend.ts`, `support/webdriver.ts` — o mesmo processo, dois nomes por assunto), que esperam a porta liberar antes e depois de cada uso.
- **`workers: 1`, `fullyParallel: false`, `retries: 0` local (1 no CI).** É deliberado: os serviços disputam portas fixas. Se o tempo doer, a saída é porta por spec, não subir os workers.
- **O recorder roda headless na suíte** (`RECORDER_HEADLESS=1` em `support/webdriver.ts`). Para assistir a uma execução: `RECORDER_HEADLESS=0 pnpm test`.
- **Vídeo de toda execução** fica em `e2e/test-results/` (`video: 'on'`) — útil para entender falha que só acontece na suíte.
- **Tags:** todo `describe` marca `['@read'|'@write', '@dominio']`, então `--grep @write` ou `--grep @recording` filtram por comportamento, não por nome de arquivo.

## Rodar tudo

Não existe um comando único que rode as três suítes. Na ordem do mais barato para o mais caro:

```sh
(cd frontend && pnpm test)
(cd backend  && pnpm test)
(cd e2e      && pnpm test)
```

As duas primeiras são independentes e podem rodar em paralelo. O E2E vai por último: é o único que sobe serviços, e uma falha nas suítes rápidas quase sempre explica a falha dele.

## No CI

`.github/workflows/ci.yml` roda dois jobs em todo push: `backend` (lint, typecheck, testes com cobertura) e `frontend` (o mesmo). A cobertura sobe como artefato (`coverage-backend`, `coverage-frontend`), e o gate está no `vitest.config.ts` de cada lado — 75% de linhas no backend, piso de 18% no frontend, onde a cobertura de tela mora no E2E e não no v8.

**O E2E não roda no CI.** A suíte depende de gravador, runner, vídeo e um Chromium de verdade, e no runner do GitHub os testes `@write` de `recording`, `runner` e CDP falham por ambiente, não por regressão. Rodar a suíte é local, antes de abrir o PR:

```sh
(cd e2e && pnpm test)                                  # tudo
(cd e2e && pnpm exec playwright test --grep @read)      # os que não gravam nem executam, ~40s
```
