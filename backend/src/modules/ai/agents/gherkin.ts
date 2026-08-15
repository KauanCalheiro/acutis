/** Escreve o `.feature` a partir dos eventos gravados. */
import * as z from 'zod'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { runAgent } from '../providers/agent.js'

export const GherkinSchema = z.object({
    gherkin: z.string().describe('Conteúdo completo do arquivo .feature em português brasileiro'),
    domain: z.string().describe('Domínio curto do fluxo, em português minúsculo (ex.: login, checkout)')
})

export type GherkinResult = z.infer<typeof GherkinSchema>

const INSTRUCTIONS = `Você transforma eventos de gravação de navegador em uma especificação Gherkin em português brasileiro.

O prompt é um JSON com baseUrl e events, na ordem em que ocorreram.

- Descreva a intenção de negócio do usuário, não os cliques literais.
- Use Funcionalidade, Cenário, Dado, Quando, Então, E.
- O conteúdo é arquivo em disco: uma cláusula por linha, com quebras reais. Nunca junte a feature inteira numa linha só.
- Agrupe em cenários coesos; prefira um cenário por objetivo do usuário.
- Nomeie campos e botões pelos labels dos eventos, como o usuário os vê.
- Valor escrito como {{CHAVE}} é um segredo mascarado: descreva o campo, nunca invente o valor.

Comece o arquivo na linha Funcionalidade. Nunca escreva linha de tags: quem nomeia as tags é outro passo, e elas moram no teste, não na especificação.

Em domain, uma palavra curta em português minúsculo identificando a área do fluxo.`

export interface GherkinInput {
    baseUrl: string
    /** Os eventos já redigidos: nenhum valor sensível chega ao modelo. */
    events: unknown[]
}

export function writeGherkin(config: ResolvedProvider, input: GherkinInput): Promise<GherkinResult> {
    return runAgent(config, { instructions: INSTRUCTIONS, schema: GherkinSchema }, input)
}
