/**
 * Confere se o provedor cadastrado responde de verdade. Vai pelo mesmo caminho dos outros agentes,
 * com saída estruturada, porque é assim que o acutis chama o modelo em todo o resto.
 */
import * as z from 'zod'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { runAgent } from '../providers/agent.js'

export const PingSchema = z.object({
    ok: z.boolean().describe('Sempre true, confirmando que a resposta chegou no formato pedido')
})

export type PingResult = z.infer<typeof PingSchema>

const INSTRUCTIONS = `Você confere se este modelo consegue responder no formato que o acutis exige.

Responda com o campo ok igual a true. Não escreva mais nada.`

export function pingModel(config: ResolvedProvider): Promise<PingResult> {
    return runAgent(config, { instructions: INSTRUCTIONS, schema: PingSchema }, { ping: true })
}
