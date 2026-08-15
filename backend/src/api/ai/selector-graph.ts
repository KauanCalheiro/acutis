/**
 * O agente que sugere `data-testid` para os elementos sem seletor estável.
 *
 * É um grafo de dois nós — escrever e revisar — porque as sugestões precisam obedecer a uma
 * convenção que o modelo erra sozinho: kebab-case e o par `<recurso>-<ação>`. Quem julga não é
 * outro modelo, são as `SelectorRules`, que já existiam e são determinísticas; o modelo só reescreve
 * o que elas apontarem.
 *
 * O laço tem teto: sem ele, um modelo que insiste no mesmo erro giraria até o timeout do usuário.
 */
import { END, START, StateGraph } from '@langchain/langgraph'
import * as z from 'zod'
import { checkSelectors, type SelectorSuggestion } from '../rules/selector-rules.js'
import type { ResolvedProvider } from '../settings/entities/ai-settings.entity.js'
import { chatModel } from './provider-model.js'

/** Quantas vezes o revisor devolve o trabalho antes de aceitar o que veio. */
const MAX_REVISIONS = 2

const SuggestionSchema = z.object({
    event: z.string().describe('O evento gravado que originou a sugestão, como "click em Entrar"'),
    currentSelector: z.string().describe('O seletor que o gravador usou, e que é frágil'),
    suggestedTestId: z.string().describe('O data-testid sugerido, em kebab-case, no par recurso-acao'),
    reason: z.string().describe('Por que o seletor atual é frágil, em uma frase')
})

const ResponseSchema = z.object({
    suggestions: z.array(SuggestionSchema)
})

const State = z.object({
    /** Os eventos sem seletor estável, como o gravador os registrou. */
    events: z.array(z.record(z.string(), z.unknown())),
    suggestions: z.array(SuggestionSchema).default([]),
    /** O que as regras apontaram na última volta, e que o próximo passe precisa consertar. */
    violations: z.array(z.string()).default([]),
    revisions: z.number().default(0)
})

type SelectorState = z.infer<typeof State>

const INSTRUCTIONS = [
    'Você sugere atributos data-testid para elementos de uma página web.',
    'Regras que a sua resposta precisa obedecer:',
    '- o testid é minúsculo, sem acento, separado por hífen (kebab-case);',
    '- ele nomeia recurso e ação, nesta ordem: "login-entrar", "carrinho-remover-item";',
    '- uma palavra só não basta, porque não diz o que o elemento faz.',
    'Responda uma sugestão por evento recebido, sem inventar eventos.'
].join('\n')

/** O grafo, montado sobre o provedor que o usuário cadastrou. */
export function selectorGraph(config: ResolvedProvider) {
    async function suggest(state: SelectorState): Promise<Partial<SelectorState>> {
        const model = await chatModel(config, 'cheapest')
        const structured = model.withStructuredOutput(ResponseSchema)

        const correction = state.violations.length === 0
            ? ''
            : `\n\nA resposta anterior violou estas regras, corrija-as:\n- ${state.violations.join('\n- ')}`

        const response = await structured.invoke([
            { role: 'system', content: INSTRUCTIONS },
            { role: 'user', content: `Eventos:\n${JSON.stringify(state.events, null, 2)}${correction}` }
        ])

        return { suggestions: response.suggestions, revisions: state.revisions + 1 }
    }

    /** Quem reprova é a regra, não o modelo: o julgamento precisa ser o mesmo em toda execução. */
    function review(state: SelectorState): Partial<SelectorState> {
        const violations = checkSelectors(state.suggestions as SelectorSuggestion[])

        return { violations: violations.map((violation) => violation.message) }
    }

    function next(state: SelectorState): 'suggest' | typeof END {
        if (state.violations.length === 0) return END

        // Estourou o teto: entrega o que tem. Uma sugestão imperfeita ainda é revisável por quem
        // pediu; uma tela girando para sempre, não.
        return state.revisions >= MAX_REVISIONS ? END : 'suggest'
    }

    return new StateGraph(State)
        .addNode('suggest', suggest)
        .addNode('review', review)
        .addEdge(START, 'suggest')
        .addEdge('suggest', 'review')
        .addConditionalEdges('review', next, ['suggest', END])
        .compile()
}

/** As sugestões para os eventos dados, já revisadas contra as regras do projeto. */
export async function suggestSelectors(
    config: ResolvedProvider,
    events: Record<string, unknown>[]
): Promise<SelectorSuggestion[]> {
    const result = await selectorGraph(config).invoke({ events })

    return result.suggestions as SelectorSuggestion[]
}
