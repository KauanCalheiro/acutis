# Testes

Como rodar cada suíte do monorepo na mão, e o que cada uma tem de peculiar.

## Sumário

- [Visão geral](#visão-geral)
- [Backend (Pest)](#backend-pest)
- [Frontend (Vitest)](#frontend-vitest)
- [Webdriver (Vitest)](#webdriver-vitest)
- [E2E (Playwright)](#e2e-playwright)
- [Rodar tudo](#rodar-tudo)

## Visão geral

| Suíte | Ferramenta | Onde ficam os testes | Comando | Precisa da stack de pé? |
|-------|-----------|----------------------|---------|-------------------------|
| Backend | Pest / PHPUnit | `backend/tests/` | `cd backend && composer test` | não |
| Frontend | Vitest + `@nuxt/test-utils` | `frontend/tests/` | `cd frontend && pnpm test` | não |
| Webdriver | Vitest | `webdriver/**/*.spec.ts` | `cd webdriver && pnpm test` | não |
| E2E | Playwright | `e2e/tests/` | `cd e2e && pnpm test` | não — a suíte sobe os três serviços sozinha |

As três primeiras são unitárias/de integração local: rodam em segundos, sem rede e sem serviço subindo. O E2E é o único caro (~2 min) e o único que exige as dependências do host instaladas (PHP, Composer, Node, pnpm).

## Backend (Pest)

```sh
cd backend
composer test                      # suíte inteira
php artisan test --filter=Recording  # um arquivo/teste
php artisan test tests/Feature/V1   # um diretório
```

### Peculiaridades

- **`composer test` roda `config:clear` antes.** Se você tiver rodado `config:cache` em algum momento, o config cacheado congela o `APP_ENV` de desenvolvimento e os testes passam a bater no banco errado. Chamar `php artisan test` direto pula essa limpeza — é seguro no dia a dia, mas se um teste falhar por motivo inexplicável de ambiente, rode `composer test`.
- **Banco é SQLite em memória**, fixado em `backend/phpunit.xml` (`DB_CONNECTION=sqlite`, `DB_DATABASE=:memory:`). Nenhum teste toca o `database/database.sqlite` de desenvolvimento nem o `database/e2e.sqlite` do E2E.
- **Nenhum teste toca o banco, e nenhuma migration roda.** O estado do domínio (projetos, cenários, execuções) vive no filesystem em `~/.acutis` e no git — as únicas migrations são scaffolding do Laravel (`users`, `cache`, `jobs`, `telescope_entries`). Como o banco é `:memory:` e o `tests/Pest.php` não usa `RefreshDatabase`, o primeiro teste que persistir algo vai falhar com `no such table`, erro que não aponta para a causa. Nesse momento, adicione `->use(RefreshDatabase::class)` no `tests/Pest.php` (ou `uses()` no arquivo do teste).
- Duas suítes declaradas no `phpunit.xml`: `Unit` (`tests/Unit`) e `Feature` (`tests/Feature`). Só a `Feature` recebe o `TestCase` do Laravel.

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

## Webdriver (Vitest)

```sh
cd webdriver
pnpm test                                        # suíte inteira
pnpm vitest run --config vite.ui.config.ts src/ui  # um diretório
```

### Peculiaridades

- **O `--config vite.ui.config.ts` não é opcional.** O `pnpm test` já o passa; chamando `vitest` na mão sem ele, os testes da pill (`src/ui/**`) não encontram o ambiente de DOM e falham por motivo errado.
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
- **O build e o seed estão no `pretest`, não no `playwright test`.** `pnpm test` dispara `scripts/setup.sh` (migrate + seed do banco de E2E, build do frontend) e o `build:ui` + `build` do webdriver. `pnpm exec playwright test` pula tudo isso. Editou `webdriver/src/**`? Rode `pnpm test` uma vez antes de escopar com `pnpm exec`, senão os testes rodam contra um bundle velho.
- **Banco dedicado.** A suíte usa `backend/database/e2e.sqlite` (gitignored) com `migrate:fresh --seed` a cada rodada. Seu banco de desenvolvimento não é tocado.
- **Portas 42xx, isoladas do desenvolvimento** (backend 4200, frontend 4300, webdriver 4400 — fonte única em `e2e/support/ports.ts`). Não é preciso derrubar a stack local para rodar a suíte. Ao checar porta ocupada, use `lsof -nP -iTCP:4300 -sTCP:LISTEN`: sem o `-sTCP:LISTEN`, o `lsof` também casa conexões do navegador e você conclui errado que há servidor de pé.
- **Só o frontend sobe pelo `webServer` do Playwright.** Backend e webdriver sobem de dentro dos próprios specs (`support/backend.ts`, `support/webdriver.ts`), que esperam a porta liberar antes e depois de cada uso.
- **`workers: 1`, `fullyParallel: false`, `retries: 0`.** É deliberado: os serviços disputam portas fixas. Se o tempo doer, a saída é porta por spec, não subir os workers.
- **O recorder roda headless na suíte** (`RECORDER_HEADLESS=1` em `support/webdriver.ts`). Para assistir a uma execução: `RECORDER_HEADLESS=0 pnpm test`.
- **Vídeo de toda execução** fica em `e2e/test-results/` (`video: 'on'`) — útil para entender falha que só acontece na suíte.
- **Tags:** todo `describe` marca `['@read'|'@write', '@dominio']`, então `--grep @write` ou `--grep @recording` filtram por comportamento, não por nome de arquivo.

## Rodar tudo

Não existe um comando único que rode as quatro suítes. Na ordem do mais barato para o mais caro:

```sh
(cd backend   && composer test)
(cd frontend  && pnpm test)
(cd webdriver && pnpm test)
(cd e2e       && pnpm test)
```

As três primeiras são independentes e podem rodar em paralelo. O E2E vai por último: é o único que sobe serviços, e uma falha nas suítes rápidas quase sempre explica a falha dele.
