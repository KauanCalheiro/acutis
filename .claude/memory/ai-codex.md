---
name: ai-codex
description: O provedor "Codex" roda o Codex CLI local pelo @openai/codex-sdk; como o binário de 262 MB fica fora do node_modules, setup e armadilhas medidas
metadata:
  type: reference
---

O provedor de id `codex` roda o **Codex instalado na máquina** através do `@openai/codex-sdk`. O SDK
não fala HTTP: ele dá `spawn` em `codex exec --experimental-json`, e a chamada sai pela assinatura
ChatGPT já autenticada no binário. Sem chave de API, sem cobrança por token. É o irmão do provedor
`claude-code`, descrito em [ai-claude-agent](ai-claude-agent.md).

Não há restrição de marca aqui: o label da tela é **Codex** e o ícone é `i-simple-icons-openai`.

## Setup, do lado do usuário

1. Instalar o Codex na máquina que roda o backend do acutis.
2. `codex login` no terminal, autorizando no navegador.
3. Na tela de configurações, escolher **Codex** e o modelo.

`CODEX_PATH` aponta para outro binário quando o `codex` não está no PATH do processo do backend;
`CODEX_MODEL` troca o modelo padrão.

Documentação: <https://developers.openai.com/codex/cli>

## Como funciona por dentro

| Arquivo | Papel |
|---------|-------|
| `backend/src/modules/ai/providers/codex-agent.ts` | `codexOutput()`, a lista de modelos e o padrão |
| `backend/src/modules/ai/providers/agent.ts` | `NATIVE_OUTPUT` desvia para o SDK do provedor nativo |
| `backend/src/modules/ai/providers/provider-errors.ts` | `codexFailure()`: binário ausente, 401, modelo recusado |
| `pnpm-workspace.yaml` | `ignoredOptionalDependencies` deixa os binários do SDK fora |

## O binário de 262 MB fica fora do node_modules

`@openai/codex-sdk` depende de `@openai/codex`, que traz um pacote de binário por plataforma, **262
MB cada**. O provedor usa o `codex` já instalado na máquina, então os seis pacotes de plataforma
entram em `ignoredOptionalDependencies` no `pnpm-workspace.yaml` e a instalação cai para **112 KB**.

`codexPathOverride` aceita nome de comando, resolvido pelo PATH. **A chave só funciona no
`pnpm-workspace.yaml`**: no `package.json` o pnpm 11 a ignora em silêncio e baixa os 262 MB.

## Armadilhas (todas medidas, 18/08/2026)

- **`project_doc_max_bytes: 0` é obrigatório.** Sem ele, um `AGENTS.md` na pasta de trabalho manda
  no agente do acutis: com um canário plantado, o modelo obedeceu à instrução do arquivo. É o
  equivalente ao `settingSources: []` do Agent SDK.
- **~12 mil tokens de entrada por chamada**, mesmo com prompt de 500 tokens: é o prompt de sistema
  do próprio Codex. Pesa no limite da assinatura ChatGPT.
- **Latência de 3 a 7 s por chamada**, na mesma faixa do Claude Agent.
- **O SDK não tem `--ignore-user-config` nem `--ephemeral`.** O `~/.codex/config.toml` da máquina
  continua valendo (MCP servers, effort) e cada geração deixa uma sessão em `~/.codex/sessions`. O
  `-m` do acutis vence o `model` de lá. Contenção do resto: `sandboxMode: 'read-only'`,
  `approvalPolicy: 'never'`, rede desligada e `workingDirectory` num `mkdtemp` vazio.
- **Não há `systemPrompt` nem `maxTurns`**: as instruções vão concatenadas no prompt.
- **A assinatura ChatGPT recusa parte dos modelos com 400, não 404**, dizendo "not supported when
  using Codex with a ChatGPT account". Verificados um por um: valem `gpt-5.6-sol`, `gpt-5.6-terra`,
  `gpt-5.6-luna`, `gpt-5.5`, `gpt-5.4` e `gpt-5.4-mini`; recusam `gpt-5.6-pro` e `gpt-5.2`.
- **Sem login, o binário responde `unexpected status 401` depois de 5 reconexões internas**, cerca de
  22 s, fora do alcance do `MAX_RETRIES` do acutis.
- **Binário ausente vem como `code: 'ENOENT'`**, não como status HTTP.

## Saída estruturada

`thread.run(prompt, { outputSchema })` devolve `finalResponse` como **JSON puro**, sem cerca
markdown. Basta `JSON.parse` e o `schema.parse` do zod. O `jsonSchemaOf()` do `claude-agent.ts` serve
sem alteração: o zod v4 já emite `additionalProperties: false` e o `required` completo.
