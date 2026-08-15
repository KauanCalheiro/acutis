/**
 * Batiza `data-testid` para elementos que hoje dependem de seletor frágil.
 *
 * Instruções portadas do `SelectorWriter` do Laravel, palavra por palavra.
 *
 * O `index` que entra volta inalterado na resposta: é ele que liga a sugestão ao elemento gravado, e
 * parear por ordem quebraria assim que o modelo devolvesse os itens embaralhados.
 */
import * as z from 'zod'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { runAgent } from '../agent.js'

export const SuggestionsSchema = z.object({
    suggestions: z.array(z.object({
        index: z.number().describe('O index recebido, sem alterar: é ele que liga a sugestão ao elemento'),
        suggestedTestId: z.string().describe('O data-testid sugerido, kebab-case, no padrão <recurso>-<acao>'),
        reason: z.string().describe('Em uma frase curta, por que o seletor atual é frágil')
    }))
})

export type Suggestions = z.infer<typeof SuggestionsSchema>

const INSTRUCTIONS = `Você batiza data-testid para elementos que hoje dependem de seletor frágil.

O prompt é uma lista de alvos, cada um com index, type, label e selector (o seletor frágil atual).

- Sugira um data-testid no padrão <recurso>-<acao>, sempre em kebab-case minúsculo (ex.: login-entrar, carrinho-remover-item).
- Use o label e o type para inferir o recurso e a ação.
- Devolva o index recebido, sem alterá-lo: é ele que liga a sugestão ao elemento.
- Em reason, diga em uma frase curta em português por que o seletor atual é frágil (classe de estilização muda, id é gerado dinamicamente, texto muda com i18n).`

/** Os seletores que valem trocar por um testid; os demais já são estáveis. */
const FRAGILE = ['id', 'cssStable', 'text'] as const

export interface SelectorTarget {
    index: number
    type: string
    label: string
    selector: string
}

/** Só os eventos cujo seletor é frágil viram alvo — os outros não têm o que melhorar. */
export function fragileTargets(events: Record<string, unknown>[]): SelectorTarget[] {
    return events.flatMap((event, index) => {
        const selectors = (event.selectors ?? null) as Record<string, string | null> | null

        if (!selectors) return []

        const key = FRAGILE.find((candidate) => Boolean(selectors[candidate]))

        if (!key) return []

        return [{
            index,
            type: String(event.type ?? ''),
            label: String(event.label ?? ''),
            selector: selectors[key]!
        }]
    })
}

export function suggestSelectors(
    config: ResolvedProvider,
    targets: SelectorTarget[]
): Promise<Suggestions> {
    return runAgent(config, { instructions: INSTRUCTIONS, schema: SuggestionsSchema }, targets)
}
