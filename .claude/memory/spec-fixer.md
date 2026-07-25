---
name: spec-fixer
description: Design aprovado (ainda NÃO implementado) do agente que corrige um cenário a partir da falha da execução — ler antes de implementar o botão "Corrigir"
metadata:
  type: project
---

Quando um step falha na execução de um cenário, mandar o contexto da falha pra um agente e receber o spec corrigido. **Design aprovado, nada implementado ainda.** O gancho já existe: o botão `execucao-corrigir` na modal (`frontend/app/components/scenario/test-run/modal.vue`) está renderizado sem handler.

Convenções que valem aqui: [backend-action](backend-action.md), [backend-contracts](backend-contracts.md), [tdd](tdd.md).

## Decisões tomadas (com o porquê)

| Decisão | Escolha | Por quê |
|---------|---------|---------|
| Autonomia | Propor diff, usuário aprova | Nada é escrito sem OK. É TCC: mostrar o que a IA mudou vale mais que correção silenciosa |
| Contexto enviado | spec + step que falhou + output do erro + snapshot do DOM + eventos gravados | Sem o DOM o agente não tem como saber o seletor certo; os eventos cobrem o caso do spec ter divergido da intenção original |
| Persistência | Reusar o `updateScenario` (PUT) existente | Já persiste conteúdo de cenário — nenhum endpoint novo pra gravar |

## Desenho

**Agente** `app/Ai/Agents/SpecFixer.php` — uma responsabilidade só, nunca multitarefa; a orquestração vive na Action, nunca no agente. Saída estruturada:

- `playwright` — arquivo `.spec.ts` completo corrigido
- `summary` — uma frase do que mudou e por quê (é o que a UI exibe)

**Action** `FixScenarioSpec` — carrega spec e eventos do disco (`Project::path`), deriva a URL dos eventos, chama `CaptureSnapshot::capture($url)`, invoca o agente, devolve a Data. **Não escreve em disco.**

**Endpoint** `POST /api/v1/projects/{project}/scenarios/{scenario}/fix`, body `{ step, error }` — só o que o front sabe e o backend não. Retorna Resource.

**Frontend** — handler no botão "Corrigir"; a modal mostra o spec proposto + o `summary`, com Aplicar/Descartar. Aplicar chama o PUT do cenário.

**Testes** — backend com `SpecFixer::fake()`/`assertPrompted`, nunca API real, assertando que o prompt carrega step, erro, snapshot e eventos. E2E mockando o endpoint: Corrigir → proposta aparece → Aplicar persiste.

## Já existe e deve ser reaproveitado

- `GenerateAuthSetup` (`app/Action/`) — **o padrão de loop já provado**: snapshot → `RunPlaywrightTest` → realimenta o erro no agente → retenta até `MAX_RUN_ATTEMPTS`. Consultar antes de escrever a Action nova.
- `app/Ai/Tools/`: `CaptureSnapshot` (recebe URL, devolve DOM), `RunPlaywrightTest`, `PlaywrightRunResult` (`passed`, `output`, `storageState`).
- `SelectorSuggestionWriter` — as instructions dele já tratam "id gerado"/classe CSS como seletor frágil; boa referência de prompt pro caso típico.

## Escopo deixado de fora de propósito

Diff visual lado a lado (com destaque de linhas) não existe como componente. Começar mostrando o spec corrigido no `BaseCodefield` (readonly) + o `summary`; só construir o diff de verdade se sentir falta.

**Caso real que motivou:** `.acutis/plataforma`, cenário `login/login-na-plataforma-univates` — o step 2 usa `page.locator('#v-0')` (id auto-gerado do Vuetify) que resolve como `hidden` e estoura 30s. O erro sozinho não diz qual seletor usar; o snapshot diz.
