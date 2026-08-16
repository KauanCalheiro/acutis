---
name: ai-claude-agent
description: O provedor "Claude Agent" — roda o Claude Code local pelo Agent SDK; nome/ícone travados por diretriz de marca, setup, e por que o caminho OAuth foi abandonado
metadata:
  type: reference
---

O provedor de id `claude-code` roda o **Claude Code instalado na máquina** através do
`@anthropic-ai/claude-agent-sdk`. O SDK conversa com o binário local, que já está autenticado, e a
chamada sai pela assinatura Claude do usuário (Pro, Max, Team, Enterprise). Sem chave de API, sem
cobrança por token.

## O nome é "Claude Agent". Nunca "Claude Code"

As [diretrizes de marca](https://code.claude.com/docs/en/agent-sdk) da Anthropic, na página do Agent
SDK, listam como **não permitidos** em produto de terceiro:

- os nomes "Claude Code" e "Claude Code Agent";
- "Claude Code-branded ASCII art or **visual elements that mimic Claude Code**" — o que inclui o logo.

Por isso, em `frontend/app/components/settings/modal.vue`:

- o label é **Claude Agent** (forma que as diretrizes preferem para menus);
- o ícone é `i-simple-icons-claude`, **não** `i-simple-icons-claudecode`.

O id interno segue `claude-code` porque é o que está gravado no banco — trocar exigiria migration sem
ganho nenhum.

**Descrever o requisito é permitido e necessário.** A restrição é o produto *se apresentar como*
Claude Code; dizer "requer o Claude Code instalado, rode `claude login`" é instrução de instalação, e
o usuário não tem como cumprir sem que a ferramenta seja nomeada. A linha: *"Claude Agent" é como o
provedor se chama; "requer o Claude Code" é o que ele precisa.*

Leitura das diretrizes públicas em 15/08/2026, não é parecer jurídico.

## Setup, do lado do usuário

1. Instalar o Claude Code na máquina que roda o backend do acutis.
2. `claude login` no terminal, autorizando no navegador.
3. Na tela de configurações, escolher **Claude Agent** e o modelo. Não há mais nada a preencher.

Documentação: <https://docs.claude.com/en/docs/claude-code/setup>

## Como funciona por dentro

| Arquivo | Papel |
|---------|-------|
| `backend/src/modules/ai/providers/claude-agent.ts` | `claudeAgentOutput()`, a lista de modelos e o schema que o CLI aceita |
| `backend/src/modules/ai/providers/agent.ts` | `ask()` desvia para o SDK quando o provedor é nativo; o resto vai pelo LangChain |
| `backend/src/modules/ai/providers/provider-model.ts` | `NATIVE`/`isNative()` — quem não é modelo do LangChain; `chatModel()` recusa esses |
| `backend/src/modules/ai/providers/model-catalog.ts` | Catálogo fixo: o binário não oferece lista |
| `backend/src/modules/settings/providers/ai-providers.ts` | `keyless: true`, sem url — não há o que cadastrar |

## Armadilhas (todas custaram tempo)

- **`z.toJSONSchema` quebra o CLI.** Ele emite `$schema: "https://json-schema.org/draft/2020-12/schema"`
  e o CLI morre com `--json-schema is not a valid JSON Schema: no schema with key or ref`. É preciso
  descartar a chave `$schema` — é o que `jsonSchemaOf()` faz.
- **`settingSources: []` é obrigatório.** Sem isso o `.claude/` da máquina (memórias, skills, CLAUDE.md)
  entra no prompt do agente do acutis.
- **Latência de 4 a 13 s por chamada**, contra ~1 s de uma API HTTP: é o spawn do binário a cada
  invocação. Aceitável para gerar cenário e consertar teste; pesa se algum dia virar laço de agente.
- **Não roda em container.** O provedor depende do binário e do login na máquina — com o backend em
  Docker, ele não funciona. A tela avisa.

## Saída estruturada

O SDK tem suporte nativo: `outputFormat: { type: 'json_schema', schema }` e a resposta chega em
`message.structured_output`. **Não** é preciso reimplementar `withStructuredOutput` por prompt e
parse. O `runAgent` valida o retorno com o próprio schema zod do agente.

Verificado nos 9 modelos que a assinatura alcança (todos menos o fable): 9/9 devolveram JSON válido.

## Por que o caminho OAuth foi abandonado

A primeira versão usava o token do `claude setup-token` como Bearer contra `api.anthropic.com` com o
cabeçalho `anthropic-beta: oauth-2025-04-20`, sem SDK nenhum. **Funcionava**, inclusive tool calling e
saída estruturada, e rodava em container. Foi descartado porque o token tem cota própria e muito
menor que a do login interativo: medido no mesmo instante, o token dava **429 em 8 dos 9 modelos**
(só o Haiku passava) enquanto o CLI logado respondia com Sonnet normalmente.

Além disso, a mesma nota das diretrizes cobre os dois caminhos: *"Anthropic does not allow third party
developers to offer claude.ai login or rate limits for their products, including agents built on the
Claude Agent SDK."* Usar a assinatura assim é uso pessoal/local, não redistribuível — vale para o
OAuth e para o SDK igualmente.

Se um dia for preciso voltar ao HTTP, o detalhe que custa meia hora: o `ChatAnthropic` força a
`apiKey` no cliente depois do spread de `clientOptions`, então é obrigatório `defaultHeaders:
{ 'x-api-key': null }` — senão a API responde 401 antes de olhar o Bearer.

## Quando o provedor recusa

`runAgent` traduz a falha por `providerFailure()` (`ai/providers/provider-errors.ts`): binário ausente
vira "instale o Claude Code e rode `claude login`", 429 vira "atingiu o limite de uso no modelo X",
401/403 vira "recusou a credencial", 404 vira "não conhece o modelo".

`MAX_RETRIES = 1`, no mesmo arquivo, vale para todos os provedores. O padrão do LangChain são **sete**
tentativas: com o provedor fora do ar, medimos **72,6 s** de espera antes de qualquer aviso na tela.
Com o teto, 1,6 s.
