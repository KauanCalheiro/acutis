# Geração de Gherkin + Playwright a partir de gravação — design

**Data:** 2026-07-03 · **Status:** aprovado

## Problema

A fixture real de gravação (`e2e/fixtures/sample-recording/`) existe para alimentar os primeiros agentes de IA do projeto, mas não há nenhum caminho no backend que receba uma gravação e produza os artefatos desejados: a descrição Gherkin do fluxo e o teste Playwright correspondente.

## Decisões (com o usuário)

1. **Forma: endpoint da API** — `POST /api/v1/recordings/tests`, síncrono, stateless (sem migration/model; tabela só quando nascer entidade persistida, alinhado à spec do catálogo).
2. **Agentes separados por responsabilidade** — um agente escreve o Gherkin, outro escreve o Playwright. Nada de agente único multitarefa.
3. **Pipeline** — `GherkinWriter` lê os eventos e escreve a feature; `PlaywrightWriter` recebe eventos **+ Gherkin** e implementa o teste fiel ao cenário descrito (saídas coerentes entre si).
4. **Provider default do `config/ai.php`** (`AI_PROVIDER`, hoje gemini) — trocar de modelo é 1 env, sem tocar código.
5. **Vídeo não vai ao modelo no v1** — só os eventos; multimodal é upgrade.

## Arquitetura

```
POST /api/v1/recordings/tests  { sessionId?, baseUrl, recordedAt?, video?, events: [...] }
  RecordingData (Spatie Data, validação pt-BR)
    ↓
  GenerateTestsFromRecording (Action)
    eventos → GherkinWriter   → { gherkin }
    eventos + gherkin → PlaywrightWriter → { playwright }
    ↓
  200 { gherkin, playwright }
```

- **`app/Ai/Agents/GherkinWriter`** — `Agent` + `HasStructuredOutput` (`{ gherkin: string }`). Instructions: feature Gherkin em pt-BR descrevendo o fluxo de negócio dos eventos (não os cliques literais).
- **`app/Ai/Agents/PlaywrightWriter`** — `Agent` + `HasStructuredOutput` (`{ playwright: string }`). Instructions: spec Playwright TypeScript implementando o cenário do Gherkin com os melhores seletores dos eventos (prioridade `dataTestId` > `id` > `finder`), asserts de URL/navegação onde o fluxo indica.
- **Pasta base nova `app/Ai/Agents/`** aprovada — convenção do laravel/ai.
- Controller `V1/RecordingTestController` só orquestra; sem Resource (não há model).

## Testes (invariante TDD — red primeiro)

- 200 com `gherkin` e `playwright` no body usando `GherkinWriter::fake()` / `PlaywrightWriter::fake()`.
- Pipeline: `PlaywrightWriter::assertPrompted` com prompt contendo o Gherkin devolvido pelo primeiro agente.
- 422 sem `events` / `events` vazio / sem `baseUrl`, mensagens pt-BR.
- `GherkinWriter::assertPrompted` confirmando que os eventos entram no prompt.

## Limites conhecidos e upgrades (só quando doer)

- **Síncrono**: chamada LLM dentro do request (dois hops). Se latência doer, vira job + polling/SSE.
- **Stateless**: nada persistido. Quando nascer catálogo de gerações, entra tabela.
- **Qualidade do prompt itera na fixture**: `e2e/fixtures/sample-recording/recording.json` é o caso de avaliação; ajustar instructions dos agentes é o loop de iteração esperado.

## Fora de escopo

Vídeo multimodal, persistência, fila/streaming, UI no frontend, escrita dos arquivos gerados em projeto.
