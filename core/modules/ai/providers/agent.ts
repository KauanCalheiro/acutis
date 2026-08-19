/** A base dos agentes: um grafo de um nó só que manda o prompt e devolve a resposta estruturada. */
import { END, START, StateGraph } from '@langchain/langgraph'
import * as z from 'zod'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { claudeAgentOutput } from './claude-agent.js'
import { codexOutput } from './codex-agent.js'
import { providerFailure } from './provider-errors.js'
import { chatModel } from './provider-model.js'

export interface AgentDefinition<Schema extends z.ZodType> {
  /** O system prompt. */
  instructions: string
  /** A forma da resposta. O modelo é obrigado a devolver exatamente isto. */
  schema: Schema
}

/** Os provedores que rodam um binário da máquina e têm laço próprio, fora do LangChain. */
const NATIVE_OUTPUT: Record<string, typeof claudeAgentOutput> = {
  'claude-code': claudeAgentOutput,
  'codex': codexOutput
}

/**
 * Uma pergunta ao provedor. Os agentes locais têm laço próprio e não passam pelo LangChain; o resto
 * vai pelo modelo do LangChain com saída estruturada.
 */
async function ask<Schema extends z.ZodType>(
  config: ResolvedProvider,
  agent: AgentDefinition<Schema>,
  input: unknown
): Promise<z.infer<Schema>> {
  const native = NATIVE_OUTPUT[config.provider]

  if (native) {
    return native(config, agent.instructions, agent.schema, input)
  }

  const model = await chatModel(config)

  const output = await model.withStructuredOutput(agent.schema).invoke([
    { role: 'system', content: agent.instructions },
    { role: 'user', content: JSON.stringify(input, null, 2) }
  ])

  return output as z.infer<Schema>
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
      try {
        return { output: await ask(config, agent, state.input) }
      } catch (error) {
        throw providerFailure(config, error)
      }
    })
    .addEdge(START, 'ask')
    .addEdge('ask', END)
    .compile()

  const result = await graph.invoke({ input })

  return result.output as z.infer<Schema>
}
