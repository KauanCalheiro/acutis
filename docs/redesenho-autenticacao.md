# Redesenho do fluxo de autenticação

Relatório do redesenho aplicado em 27/07/2026. Nada foi commitado — os artefatos estão no working tree para revisão por `git diff`.

## Por que redesenhar

A análise do fluxo anterior encontrou duas estratégias de sessão convivendo sem que nenhuma funcionasse inteira:

O `playwright.config.ts` declarava `dependencies: ['setup']` e o runner chamava `npx playwright test` sem `--no-deps`, então **todo run re-executava o `auth.setup.ts`** e sobrescrevia o `storage-state.json`. Mas o caminho de "sucesso" da gravação (`storageCaptured`) retornava antes de escrever o `.env`. Resultado: quando a gravação capturava a sessão — o caso comum e desejado — o projeto ficava sem `AUTH_USER`/`AUTH_PASSWORD`, o setup falhava em todo run, e a interface exibia um alerta verde dizendo "os testes do projeto já rodam autenticados".

Havia mais: `.env` e `playwright.config.ts` sobrescritos destrutivamente, um caminho manual de ~200 linhas sem nenhum caller, correção de IA rodando em background sem que o usuário soubesse, dois agentes com regras de seletor conflitantes editando o mesmo arquivo, e `auth_status` derivado de `File::exists()`.

## Os seis princípios

1. **O `auth.setup.ts` é um teste como qualquer outro.** Mesmo runner, mesmo streaming, mesmo histórico de runs, mesmo fix por IA, mesmo editor. Se uma capacidade só serve para auth, ela está no lugar errado.
2. **Uma estratégia de sessão, não duas.** Credenciais reais no `.env`, login executado a cada run. O `storage-state.json` é **saída** do setup, nunca entrada.
3. **Status é resultado de execução, nunca existência de arquivo.**
4. **Nada muda no disco depois que a tela fechou.** Sem `dispatch()->afterResponse()`.
5. **Escrever no projeto é merge, nunca overwrite.** Os arquivos do projeto são do usuário.
6. **Uma correção, um corretor, sempre com os eventos em mãos.**

## O fluxo resultante

```
Projeto sem auth → alerta → [Configurar] → modal → [Gravar]
                                                      ↓
                                   recorder abre, usuário loga de verdade
                                                      ↓
                        AuthRecordingWriter escreve tests/auth.setup.ts
                        credenciais extraídas → .env (merge)
                          └─ não extraiu? pede usuário/senha no modal
                                                      ↓
                        roda pelo runner compartilhado, com streaming
                                                      ↓
                  ┌──────── passou ────────┐  ┌──────── falhou ────────┐
                  runs/auth/ + configured     runs/auth/ + failing
                                              [Corrigir com IA] → SpecFixer
```

## O que foi deletado

| Arquivo | Motivo |
|---|---|
| `backend/app/Action/WriteAuthSetupToProject.php` | caminho manual, sem caller |
| `backend/app/Action/GenerateAuthSetup.php` | `handle`/`write` eram o caminho manual; `correct`/`retry` viraram `SpecFixer`; executar e validar virou chamada ao runner compartilhado |
| `backend/app/Ai/Agents/AuthSetupWriter.php` | segundo agente, com regras de seletor conflitantes |
| `backend/app/Data/V1/Auth/AuthSetupData.php` | só existia para os dois acima |
| `backend/app/Support/SessionState.php` | a sessão da gravação deixou de ser artefato |
| `backend/stubs/playwright-auth/` | virou um stub só (ver abaixo) |
| `frontend/server/api/projects/[slug]/auth.post.ts` | proxy órfão |
| rota `POST /projects/{p}/auth` + `ProjectController::auth()` | idem |
| `backend/tests/Feature/V1/ProjectAuthTest.php` | cobria o caminho manual removido |

A deleção do teste foi explicitamente aprovada antes de acontecer — a regra do projeto proíbe apagar teste sem pedido do usuário.

## O que mudou

**Um stub de config, não dois.** Os dois stubs eram idênticos exceto pelos `projects` de autenticação. Agora há um só, e ele decide em tempo de carga:

```ts
const autenticado = existsSync('tests/auth.setup.ts')
// dependencies: autenticado ? ['setup'] : []
// use: autenticado ? { storageState: 'storage-state.json' } : {}
```

Projeto sem auth roda normalmente; projeto com auth executa o login antes dos cenários. Nenhum config precisa ser reescrito depois.

**A URL do sistema foi para o `.env`.** `baseURL: process.env.BASE_URL || 'http://localhost:3000'`. O `.env` é mesclável, o TypeScript não — é assim que o princípio 5 se sustenta sem escrever um parser. `AuthProjectFiles::ensureConfig()` só escreve o stub quando o projeto não tem config nenhum (clone sem config).

**`.env` por merge.** `AuthProjectFiles::writeCredentials()` usa o `mergeEnv` que já existia e era usado pelos cenários — o caminho de auth é que passava por fora com `File::put`.

**`auth_status` derivado do histórico.** `ScenarioRuns::lastPassed($path, 'auth')`. Três estados: `unset`, `configured`, `failing`. Sem execução registrada (projeto clonado, script escrito à mão) vale o benefício da dúvida — não dá para afirmar que falha algo que nunca rodou.

**O fixer atende auth.** `Scenario::specPath()` resolve o id `auth` para `tests/auth.setup.ts`; `Scenario::eventsPath()` acha o arquivo de eventos irmão de um `.spec.ts` ou de um `.setup.ts`. Os eventos da gravação passaram a ser persistidos em `tests/auth.events.json`, com a senha mascarada — é o que faz o princípio 6 ser real.

**Streaming extraído para composable.** `frontend/app/composables/run-stream.ts` — 55 linhas de `EventSource` que a página de cenário tinha inline e que a página de projeto precisaria duplicar. Agora as duas usam a mesma peça.

**Modais reusados.** `ScenarioTestRunModal` e `ScenarioFixModal` já eram prop-driven; a página de projeto os monta com `scenario-name="Autenticação"`. Nenhum componente novo de execução ou correção foi escrito.

## Verificação

**Backend (Pest):** 147/147. Cobre `.env` preservando chaves preexistentes, config não sobrescrito quando já existe, `auth_status` derivado do histórico em ambas as direções, pedido de credenciais quando a extração falha, eventos persistidos com senha mascarada, e ausência de qualquer execução dentro da Action.

**E2E (Playwright):** 99/99. Inclui os 7 testes de auth que estavam desativados com `skip` e foram reativados, mais o alerta `failing` e o caminho de credenciais manuais.

**Aceite manual na Univates** — `univates.br/plataforma`, matrícula 733787, login real gravado pelo recorder e executado pelo runner:

| Verificação | Resultado |
|---|---|
| Extração de credenciais de um login real | `AUTH_USER=733787` correto, mesmo com um clique entre o carregamento e o preenchimento |
| Senha fora do script | confirmado — só em `.env`, gitignorado |
| `BASE_URL` mesclado no `.env` | `https://www.univates.br` |
| Execução do setup | passou, 5 passos verdes |
| Sessão produzida | `storage-state.json` com 2 cookies e 1 origin |
| `auth_status` | `configured`, derivado do run |

O login da Univates é o caso difícil: os campos `#v-0`/`#v-1` (ids gerados pelo Vuetify) começam com `visible: false` e só aparecem depois de clicar em "Entrar com usuário/código". O agente reproduziu o clique de revelação corretamente a partir dos eventos gravados.

### O que o teste real encontrou

A primeira gravação **falhou**, e foi útil: o `AuthRecordingWriter` não envolvia as ações em `setup.step()`, então a execução chegava ao fim com `steps: []`. Consequências em cadeia: sem timeline ao vivo, e o botão "Corrigir" nunca aparecia — ele depende de existir um passo com status `failed`. O princípio 1 estava escrito no código mas não valia na prática.

Corrigido no prompt do agente, com a razão explícita ("sem isso a execução não tem timeline e não dá pra apontar qual etapa quebrou"). Na segunda gravação a timeline apareceu com cinco passos e o login passou.

## Segunda fase — autenticação nos cenários novos

O redesenho acima deixou a autenticação funcionando na execução, mas a gravação continuava abrindo um navegador limpo: gravar um cenário de área logada significava logar de novo dentro da gravação, e o spec gerado nascia com passos de login que falhariam depois (o setup já teria autenticado, e o app redireciona quem está logado para longe do login).

### As duas decisões

**A sessão vem de uma execução fresca do setup**, não do arquivo em disco. Ao escolher "cenário autenticado", o `auth.setup.ts` roda primeiro pelo runner compartilhado, com o mesmo streaming de sempre, e a sessão recém-gerada é injetada no contexto da gravação. Sempre válida, sem heurística de expiração, sem detectar "caiu no login". Custo: ~10s antes de cada gravação. Se o login falhar, o navegador nem abre — o resultado aparece no modal.

**A distinção mora numa tag.** Cenário público ganha `@publico`; o resto é autenticado por padrão. A config separa em dois projects:

```ts
{ name: 'publicos',     grep: /@publico/ }
{ name: 'autenticados', grepInvert: /@publico/, dependencies: ['setup'], use: { storageState } }
```

Isso é o que permite testar a própria tela de login, cadastro ou uma landing num projeto que tem autenticação.

Um default que vale explicitar: **cenário gravado num projeto sem auth não recebe a tag**. Se auth for configurada depois, esses cenários passam a rodar autenticados — que é o que vão precisar. Tagear como público congelaria eles no estado errado.

### Interface

O dropdown com as duas opções só aparece quando o projeto tem autenticação configurada. Sem auth, é o botão simples de antes — não faz sentido oferecer um caminho que não existe.

### A gravação abre direto no sistema

Não bastava injetar a sessão: o recorder abria em `about:blank` e o usuário tinha que digitar a URL de novo — a mesma fricção que a feature existe para eliminar, e a gravação ainda começava com um `navigate` para `about:blank`.

A URL vem de `recording_url`, calculado em `ShowProject::recordingUrl()`. A escolha da fonte importa: o `BASE_URL` do `.env` é **só a origem**, porque é isso que o `baseURL` do Playwright precisa ser para resolver caminhos relativos (`page.goto('/foo')` com base `https://site.com/app` resolveria para `https://site.com/foo`). Usá-lo abriria o navegador no site institucional em vez do sistema. A primeira navegação do login gravado — que já está em `tests/auth.events.json` — é a página real de entrada. O `BASE_URL` fica como fallback para projetos sem eventos de auth.

Isso apareceu no teste real: com a origem, o recorder abriu em `https://www.univates.br/` (a home de marketing), que carrega recaptcha e GTM e encheu a gravação de `navigate` de iframe. Com a URL de entrada, abre em `https://www.univates.br/plataforma/` e o ruído some junto.

### Verificação

**Backend:** 152/152, incluindo dois testes para o carimbo da tag (público marca, padrão não marca) e três para a URL de gravação (usa a página do login gravado, cai no `BASE_URL` sem eventos, nula quando não há nenhum dos dois).

**E2E:** 102/102, com três testes novos: dois provam a injeção de sessão pelo gateway — um injeta um `storage-state.json` e confirma que a sessão está viva na página gravada sem ninguém ter logado, o outro confirma que sem sessão o contexto nasce limpo; o terceiro confirma que a gravação abre direto na URL do projeto. A suíte de gravação rodou três vezes seguidas (a memória do webdriver exige isso: corrida de estado só aparece estatisticamente).

**Combinação `grep` de project com `--grep` de linha de comando:** verificada empiricamente antes de escolher o mecanismo, e de novo no projeto real. Os dois se combinam como E lógico, sem contaminação entre projects — inclusive com a mesma tag presente nos dois lados.

**Aceite manual na Univates:** escolhido "cenário autenticado", o login rodou ao vivo (5 passos verdes), o modal fechou sozinho e a gravação começou. O evento gravado foi `https://www.univates.br/plataforma/` — **sem redirecionar para `/plataforma/login`**, que é exatamente onde o mesmo `goto` caía quando o recorder abria limpo. O navegador nasceu dentro do sistema.

Na segunda passada, com a URL de entrada corrigida, a gravação começou em `https://www.univates.br/plataforma/` sem ninguém digitar nada — a primeira e única navegação registrada.

## Pendências conhecidas

- **Projetos existentes não ganham a config nova.** `ensureConfig` só escreve o stub quando o projeto não tem `playwright.config.ts` — é o princípio 5 funcionando, mas significa que projeto criado antes desta mudança fica sem os projects `publicos`/`autenticados` e a tag `@publico` não tem efeito nenhum nele. Confirmei isso no projeto de teste da Univates: ele continuou com o project `cenarios` antigo. Não há caminho de migração; o mínimo seria a ferramenta detectar um config sem o project `publicos` e avisar.
- **Run sem passo nenhum não oferece correção.** O gate `failedStep !== -1` no modal de execução vale para cenários também: se um spec quebra antes de qualquer `step` (erro de sintaxe, import inválido), o usuário fica sem o botão "Corrigir" e sem o erro de nível de run na interface. Não é específico de auth e ficou fora deste escopo.
- **`storageState` continua sendo capturado pelo webdriver** e não é mais consumido por ninguém. Remover isso mexe no recorder e nos tipos do gateway — diff maior, sem relação com o desenho.
- **Heurística de extração.** `RecordingCredentials::extract()` assume que o `fill` anterior ao de senha é o usuário. Aguentou o login real da Univates, mas quebra com um campo extra antes (ex.: "empresa") — nesse caso cai no pedido manual de credenciais, que é o comportamento desejado.

## Ambiente do teste

O projeto `.acutis/univates-plataforma` ficou no disco com a senha real em `.env`. A pasta é gitignorada (`/.acutis/*`), mas a senha está em texto plano ali e no histórico desta conversa — vale trocá-la.
