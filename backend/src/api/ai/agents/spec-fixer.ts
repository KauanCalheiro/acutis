/**
 * Conserta um teste Playwright que quebrou, seja por regra violada, seja por falha na execução.
 *
 * Instruções portadas do `ScenarioFixer` do Laravel, palavra por palavra.
 *
 * Usa o modelo esperto: errar aqui custa outra execução inteira do teste ao usuário, que é o passo
 * mais lento do produto.
 */
import * as z from 'zod'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { runAgent } from '../agent.js'

export const FixedSpecSchema = z.object({
    playwright: z.string().describe('Conteúdo completo do arquivo corrigido, com quebras de linha reais'),
    summary: z.string().describe('Uma frase em português dizendo o que mudou e por quê')
})

export type FixedSpec = z.infer<typeof FixedSpecSchema>

const INSTRUCTIONS = `Você conserta um teste Playwright que não passou.

O prompt é um JSON com: spec (o arquivo atual), violations (as regras quebradas, cada uma com rule e message) e, quando houver, run (o passo e o erro da execução), html (a página no instante em que quebrou) e events (a gravação original).

- Conserte a causa, não o sintoma: elemento hidden pede o equivalente visível do html, não uma espera maior.
- O html é a página como está agora, já autenticada: é ali que aparece o elemento que mudou de nome.
- A causa mais comum é seletor frágil, como id gerado pelo framework (#v-0, :r3:), classe de estilização ou texto que muda com i18n. Prefira, nesta ordem: getByTestId, getByLabel, getByRole com nome acessível.
- Cada violation diz o que precisa mudar; resolva todas.
- Preserve o que já funciona: títulos dos steps, tags do describe, ordem dos passos e os dados preenchidos.
- Nunca invente seletor que não apareça no html ou nos eventos.
- Use os eventos para confirmar a intenção original quando o arquivo tiver divergido dela.
- O valor de playwright é conteúdo de arquivo em disco: uma instrução por linha, quebras reais, indentação de 4 espaços. Nunca junte tudo numa linha só.

Responda de uma vez, com o arquivo inteiro corrigido. Quem recebe executa e confere as regras; se ainda quebrar, você recebe o resultado de volta num pedido novo.

No summary, explique em uma frase, em português, o que mudou e por quê.`

export interface SpecFixInput {
    spec: string
    violations: { rule: string, message: string }[]
    /** O passo e o erro, quando o arquivo quebrou executando em vez de na regra. */
    run?: { step?: string, error?: string }
    /** A página no instante da falha. Grande, então só vai quando existe. */
    html?: string
    events?: unknown[]
}

export function fixSpec(config: ResolvedProvider, input: SpecFixInput): Promise<FixedSpec> {
    return runAgent(
        config,
        { instructions: INSTRUCTIONS, schema: FixedSpecSchema, tier: 'smartest' },
        input
    )
}
