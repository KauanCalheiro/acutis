/** Nomeia o teste: título, nome de arquivo e tags. */
import * as z from 'zod'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { runAgent } from '../providers/agent.js'

export const MetadataSchema = z.object({
  title: z.string().describe('O título do teste, como uma pessoa o chamaria, em português'),
  fileName: z.string().describe('O nome do arquivo em kebab-case minúsculo, sem extensão e sem acento'),
  tags: z.array(z.string()).describe('As tags do teste, cada uma começando com @')
})

export type TestMetadata = z.infer<typeof MetadataSchema>

const INSTRUCTIONS = `Você nomeia um teste automatizado a partir da especificação Gherkin dele.

O prompt é um JSON com gherkin (a especificação) e, quando houver, domain (a área do fluxo).

- O title é como uma pessoa chamaria o teste numa conversa, em português, sem prefixo técnico. Tire-o da linha Funcionalidade, encurtando o que for longo demais.
- O fileName é o title em kebab-case minúsculo, sem acento, sem espaço e sem extensão. Ele vira caminho em disco e parte da URL: mantenha curto, no máximo seis palavras.
- As tags começam com @ e são minúsculas. A primeira é exatamente uma entre @read (o fluxo só consulta) e @write (cria, altera ou remove dados). Depois dela, uma ou duas tags da área do fluxo, em português. O Gherkin não traz tags: decida pelo que o fluxo faz.
- Nunca invente informação que não esteja no Gherkin.`

export interface MetadataInput {
  gherkin: string
  domain?: string
}

export function writeMetadata(config: ResolvedProvider, input: MetadataInput): Promise<TestMetadata> {
  return runAgent(config, { instructions: INSTRUCTIONS, schema: MetadataSchema }, input)
}
