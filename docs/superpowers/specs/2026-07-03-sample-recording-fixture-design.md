# Fixture real de gravação (eventos + vídeo) para agentes de IA — design

**Data:** 2026-07-03 · **Status:** aprovado

## Problema

Os primeiros testes com agentes de IA no projeto precisam da saída real do webdriver (eventos de gravação + vídeo) para avaliar se o formato é adequado para gerar Gherkin e testes Playwright. Hoje essa saída só existe ao vivo: eventos transmitidos por WS durante a sessão e um `.webm` por sessão em `webdriver/.tmp/videos/` (não versionado). Não há arquivo persistido para iterar em cima.

## Decisões (com o usuário)

1. **Capturar uma sessão real** (não mock à mão) — o JSON de eventos e o `.webm` vêm da **mesma sessão**, com os seletores exatamente como o capture emite.
2. **Fluxo com no mínimo 10 steps.**
3. Fixture versionada em `e2e/fixtures/sample-recording/`.

## Arquitetura

O frontend `/record` é só um cliente WS do gateway — o script de captura assume esse papel (WebSocket nativo do Node), sem subir o frontend.

```
e2e/scripts/capture-sample-recording.ts (pnpm capture:fixture)
  sobe webdriver buildado (WEBDRIVER_TEST_MODE=1) + servidor da fixture
  WS ws://localhost:4000/ws → START_RECORDING
  dirige o fluxo via POST /debug/goto|click|fill
  STOP_RECORDING → recorder:stop { sessionId }
  escreve e2e/fixtures/sample-recording/
    recording.json  — { sessionId, baseUrl, recordedAt, video, events: RecordingEvent[] }
    recording.webm  — cópia de webdriver/.tmp/videos/<sessionId>.webm
```

Componentes novos:

- **`POST /debug/fill`** — `debugFill(selector, value)` no `RecorderService` (`page.fill`), mesmo padrão e guarda de test mode do `debug/click`. O `page.fill` dispara `change`, que o recorderCore já captura como evento `fill`.
- **`e2e/fixtures/sample-app.html`** — mini-app self-contained: view de login em `/` (nome, email, senha, checkbox, submit) e view de lista em `/app` (busca, itens, logout), com seletores ricos (id, `data-testid`, aria, labels) para o agente ter material real de avaliação.
- **Script de captura** — espera cada evento chegar no WS antes do próximo passo (determinístico) e valida a própria saída: `events.length >= 10`, presença de navigate/fill/click/submit, `.webm` não-vazio.

## Fluxo gravado (~12 eventos)

navigate `/` → fill nome → fill email → fill senha → click checkbox → click entrar → submit → navigate `/app` → fill busca → click item → click detalhe → click sair.

## Limites conhecidos e upgrades (só quando doer)

- **Sem eventos `assert`/`hover` no v1.** Eles só nascem pela pill, que vive num shadow root **fechado** — seletor Playwright não atravessa; dirigir por coordenada (pill + popover) é frágil demais. Upgrade se o agente precisar de asserts na fixture: hook de test mode no bundle da pill expondo o fluxo de assert, ou uma gravação manual única.
- **Envelope é proposta do formato de persistência futuro.** Quando o webdriver ganhar persistência de eventos, este envelope (`sessionId`, `baseUrl`, `recordedAt`, `video`, `events`) é o ponto de partida — a avaliação do agente valida/refuta o formato antes de virar feature.
- **Fixture desatualiza se o formato de evento mudar.** Re-rodar `pnpm capture:fixture` regenera tudo.

## Testes (invariante TDD)

- E2E red/green para `POST /debug/fill`: sessão iniciada via WS, fill num input da fixture, evento `recorder:fill` com o valor chega no WS.
- O script de captura carrega a própria verificação (asserts de contagem/tipos/vídeo) — falha ruidosamente se a saída degradar.

## Fora de escopo

Persistência de eventos no webdriver, asserts na fixture, endpoint de captura em produção, o agente em si.
