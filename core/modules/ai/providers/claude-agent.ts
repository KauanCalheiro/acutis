/**
 * O provedor que roda pelo Claude Code instalado na máquina do usuário: o SDK conversa com o binário
 * local, que já está autenticado, e a chamada sai pela assinatura dele em vez de uma chave de API.
 *
 * Na tela ele se chama **Claude Agent**, nunca "Claude Code" — diretriz de marca da Anthropic, ver a
 * memória [ai-claude-agent]. O id interno segue `claude-code` por já estar gravado no banco.
 */
import { query } from '@anthropic-ai/claude-agent-sdk'
import type * as z from 'zod'
import { toJSONSchema } from 'zod'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'

/**
 * Os modelos que o Claude Code alcança, todos verificados por este projeto. A lista é fixa porque o
 * binário não oferece um catálogo; o campo da tela continua aceitando um nome digitado à mão.
 */
export const CLAUDE_AGENT_MODELS = [
  'claude-opus-5',
  'claude-sonnet-5',
  'claude-opus-4-8',
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'claude-opus-4-5-20251101',
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-5-20250929'
]

/** O modelo que vale sem ninguém escolher. */
export const CLAUDE_AGENT_DEFAULT_MODEL = 'claude-sonnet-5'

/**
 * O schema do agente no formato que o CLI aceita. O `toJSONSchema` marca a saída com
 * `$schema: draft/2020-12` e o CLI recusa o que não resolve: `--json-schema is not a valid JSON
 * Schema: no schema with key or ref`.
 */
export function jsonSchemaOf(schema: z.ZodType): Record<string, unknown> {
  const { $schema, ...resto } = toJSONSchema(schema) as Record<string, unknown>

  return resto
}

/** O texto que o SDK devolveu quando a execução falhou. */
function errorOf(result: Record<string, unknown>): string {
  const errors = result.errors

  return Array.isArray(errors) && errors.length > 0 ? errors.join('; ') : String(result.subtype ?? 'falha sem motivo')
}

/** Roda o agente pelo Claude Code local e devolve a saída já validada pelo schema. */
export async function claudeAgentOutput<Schema extends z.ZodType>(
  config: ResolvedProvider,
  instructions: string,
  schema: Schema,
  input: unknown
): Promise<z.infer<Schema>> {
  let structured: unknown

  for await (const message of query({
    prompt: JSON.stringify(input, null, 2),
    options: {
      model: config.model ?? CLAUDE_AGENT_DEFAULT_MODEL,
      systemPrompt: instructions,
      // Este agente só pensa: quem lê disco e roda teste é o acutis, não o Claude Code.
      allowedTools: [],
      maxTurns: 1,
      // Sem isto, o `.claude/` da máquina entraria no prompt do agente do acutis.
      settingSources: [],
      outputFormat: { type: 'json_schema', schema: jsonSchemaOf(schema) }
    }
  })) {
    if (message.type !== 'result') continue

    const result = message as unknown as Record<string, unknown>

    if (result.is_error === true) throw new Error(errorOf(result))

    structured = result.structured_output
  }

  return schema.parse(structured)
}
