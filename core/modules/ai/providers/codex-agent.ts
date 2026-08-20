/**
 * O provedor que roda pelo Codex instalado na máquina do usuário: o SDK conversa com o binário
 * local, que já está autenticado, e a chamada sai pela assinatura dele em vez de uma chave de API.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type * as z from 'zod'
import { jsonSchemaOf } from './claude-agent.js'
import { APP_CONFIG } from '../../../config/env.js'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'

/**
 * Os modelos que a assinatura ChatGPT alcança pelo Codex, todos verificados por este projeto. A
 * lista é fixa porque o binário não oferece um catálogo; o campo da tela continua aceitando um nome
 * digitado à mão.
 */
export const CODEX_MODELS = [
  'gpt-5.6-sol',
  'gpt-5.6-terra',
  'gpt-5.6-luna',
  'gpt-5.5',
  'gpt-5.4',
  'gpt-5.4-mini'
]

/** O modelo que vale sem ninguém escolher. */
export const CODEX_DEFAULT_MODEL = 'gpt-5.6-sol'

/** Roda o agente pelo Codex local e devolve a saída já validada pelo schema. */
export async function codexOutput<Schema extends z.ZodType>(
  config: ResolvedProvider,
  instructions: string,
  schema: Schema,
  input: unknown
): Promise<z.infer<Schema>> {
  const { Codex } = await import('@openai/codex-sdk')
  const workingDirectory = await mkdtemp(join(tmpdir(), 'acutis-codex-'))

  try {
    const thread = new Codex({
      codexPathOverride: APP_CONFIG.providers.codexPath,
      // Sem isto, um `AGENTS.md` na pasta de trabalho entraria no prompt do agente do acutis.
      config: { project_doc_max_bytes: 0 }
    }).startThread({
      model: config.model ?? CODEX_DEFAULT_MODEL,
      workingDirectory,
      skipGitRepoCheck: true,
      // Este agente só pensa: quem lê disco e roda teste é o acutis, não o Codex.
      sandboxMode: 'read-only',
      approvalPolicy: 'never',
      networkAccessEnabled: false,
      webSearchEnabled: false
    })

    const turn = await thread.run(`${instructions}\n\n${JSON.stringify(input, null, 2)}`, {
      outputSchema: jsonSchemaOf(schema)
    })

    return schema.parse(JSON.parse(turn.finalResponse))
  } finally {
    await rm(workingDirectory, { recursive: true, force: true })
  }
}
