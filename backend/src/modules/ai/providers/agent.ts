/** A base dos agentes: um grafo de um nó só que manda o prompt e devolve a resposta estruturada. */
import { END, START, StateGraph } from '@langchain/langgraph'
import * as z from 'zod'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { chatModel } from './provider-model.js'

export interface AgentDefinition<Schema extends z.ZodType> {
    /** O system prompt. */
    instructions: string
    /** A forma da resposta. O modelo é obrigado a devolver exatamente isto. */
    schema: Schema
}

/** Roda o agente uma vez; quem precisa de laço o monta por fora. */
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
            const model = await chatModel(config)
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
