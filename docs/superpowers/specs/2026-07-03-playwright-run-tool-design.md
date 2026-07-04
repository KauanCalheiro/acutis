# Tool de execução do Playwright gerado + loop de autocorreção — design

**Data:** 2026-07-03 · **Status:** aprovado

## Problema

O `PlaywrightWriter` gera o spec mas ninguém confirma que ele roda. O usuário quer: gerar → executar → se falhar, devolver o erro ao agente e gerar de novo, até passar (ou desistir). A tool vive em `app/Ai/Tools/` no backend.

## Restrição que define a arquitetura

O backend é um container PHP — sem node, sem Chromium. Quem sabe executar Playwright é o serviço **webdriver** (node + Playwright + Chromium via xvfb). Logo: a execução mora no webdriver; a tool do backend é o cliente HTTP dessa execução.

## Arquitetura

```
POST /api/v1/recordings/tests { ..., executionUrl? }
  Action:
    gherkin  = GherkinWriter(eventos)
    spec     = PlaywrightWriter(eventos + gherkin [+ pausas])
    sem executionUrl → responde como hoje (testRun: null)
    com executionUrl:
      até 3 tentativas:
        specExec = spec com baseUrl gravada trocada por executionUrl
        resultado = RunPlaywrightTest::run(specExec)      ← app/Ai/Tools
        passou → fim
        falhou → PlaywrightWriter(gherkin + eventos + spec anterior + erro)
  200 { gherkin, playwright, testRun: { executed, passed, attempts, error } }
```

- **Webdriver `POST /runner/spec`** `{ spec }` → `{ passed, output }`: grava o spec em diretório temporário isolado, roda `npx playwright test` (dep nova `@playwright/test`, mesma versão do `playwright`), timeout de 60s, sempre limpa o temporário. Guardado por `WEBDRIVER_TEST_MODE=1` como os endpoints de debug (o compose dev já seta). Executa código arbitrário por design — aceitável porque o serviço é interno de dev; nunca expor publicamente.
- **`app/Ai/Tools/RunPlaywrightTest`** — classe simples (AsAction não: não é regra de negócio; é uma tool). `Http::post(acutis()->webdriverUrl.'/runner/spec')`. Config nova `acutis.webdriver.url` (env `WEBDRIVER_URL`, default `http://webdriver:4000` — nome do serviço na rede do compose) + campo no resolver `AcutisConfig`.
- **`executionUrl`** (opcional, url válida): onde a aplicação-alvo está acessível **a partir do container do webdriver** (ex.: `http://host.docker.internal:52346`). A gravação usa porta efêmera morta; sem uma URL viva o teste falharia por conexão e o loop retentaria à toa — por isso a execução é opt-in.
- O spec devolvido ao cliente mantém a baseUrl gravada (canônico); a troca por `executionUrl` só existe na cópia executada.
- Quando o modelo tiver function calling (Gemma não tem), `RunPlaywrightTest` é candidata natural a virar Tool nativa do laravel/ai anexada ao agente.

## Testes (invariante TDD — red primeiro)

- **e2e (webdriver):** `POST /runner/spec` com spec trivial que passa → `{ passed: true }`; com spec que falha → `{ passed: false }` e `output` contendo o erro.
- **backend (Pest, `Http::fake` + agent fakes):**
  - `executionUrl` presente, runner passa → `testRun.passed=true, attempts=1`; request ao runner contém a URL reescrita.
  - Runner falha 1x e passa na 2ª → `attempts=2`, PlaywrightWriter promptado 2x, 2º prompt contém o erro.
  - Runner falha sempre → `attempts=3, passed=false, error` presente, ainda 200 com o último spec.
  - Sem `executionUrl` → nada enviado ao runner, `testRun` null (contrato atual intacto).

## Limites conhecidos e upgrades (só quando doer)

- **3 tentativas fixas** — vira parâmetro se precisar.
- **Latência**: cada tentativa = 1 chamada LLM + 1 execução Playwright, tudo síncrono. Fila/SSE quando doer.
- **Runner roda 1 spec por request, sem paralelismo** — suficiente pra iteração; pool se virar gargalo.

## Fora de escopo

Function calling nativo, persistência das tentativas, execução paralela, UI.
