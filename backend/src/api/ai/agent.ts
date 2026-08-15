/**
 * A base dos agentes: um grafo de um nó só que manda o prompt e devolve a resposta estruturada.
 *
 * É pouca coisa de propósito. Cada agente traz três coisas — instruções, o schema da resposta e o
 * que entra no prompt — e nada além disso: o julgamento do que veio é das regras determinísticas,
 * que rodam fora daqui, e o encadeamento é de quem chama.
 */
import { END, START, StateGraph } from '@langchain/langgraph'
import * as z from 'zod'
import type { ResolvedProvider } from '../settings/entities/ai-settings.entity.js'
import { chatModel, type ModelTier } from './provider-model.js'

export interface AgentDefinition<Schema extends z.ZodType> {
    /** O system prompt. É o contrato com o modelo, e mudá-lo muda o produto. */
    instructions: string
    /** A forma da resposta. O modelo é obrigado a devolver exatamente isto. */
    schema: Schema
    /**
     * Qual modelo cadastrado usar.
     *
     * O barato dá conta do que é mecânico (nomear, resumir); o esperto vale onde errar custa uma
     * volta inteira do usuário, como consertar um teste que não passou.
     */
    tier?: ModelTier
}

/**
 * Roda o agente uma vez.
 *
 * O grafo tem um nó só porque é isso que o trabalho exige — quem precisa de laço (gerar, checar
 * regra, corrigir) monta o laço por fora, chamando isto de novo com o que a regra apontou. Manter o
 * laço fora do agente é o que deixa a regra ser a mesma em toda execução, e não algo que o modelo
 * decide se consulta.
 */
export async function runAgent<Schema extends z.ZodType>(
    config: ResolvedProvider,
    agent: AgentDefinition<Schema>,
    input: unknown
): Promise<z.infer<Schema>> {
    const State = z.object({
        input: z.unknown(),
        output: z.unknown().optional()
    })

    const graph = new StateGraph(State)
        .addNode('ask', async (state) => {
            const model = await chatModel(config, agent.tier ?? 'cheapest')
            const structured = model.withStructuredOutput(agent.schema)

            const output = await structured.invoke([
                { role: 'system', content: agent.instructions },
                { role: 'user', content: JSON.stringify(state.input, null, 2) }
            ])

            return { output }
        })
        .addEdge(START, 'ask')
        .addEdge('ask', END)
        .compile()

    const result = await graph.invoke({ input })

    return result.output as z.infer<Schema>
}
