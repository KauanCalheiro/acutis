import * as z from 'zod'

export const suiteRunTestSchema = z.object({
  id: z.string(),
  title: z.string(),
  spec: z.string(),
  passed: z.boolean(),
  duration_ms: z.number(),
  steps: z.number(),
  failed_step: z.string().nullable()
})

export type SuiteRunTest = z.output<typeof suiteRunTestSchema>

/** Uma execução agrupada do projeto: a rodada inteira, com o resultado de cada cenário. */
export const suiteRunSchema = z.object({
  started_at: z.string(),
  duration_ms: z.number(),
  passed: z.boolean(),
  /** O `--grep` que decidiu quem rodou; null quando a rodada foi do projeto inteiro. */
  filter: z.string().nullable(),
  branch: z.string().nullable(),
  author: z.string().nullable(),
  totals: z.object({
    tests: z.number(),
    passed: z.number(),
    failed: z.number(),
    steps: z.number()
  }),
  tests: z.array(suiteRunTestSchema)
})

export type SuiteRun = z.output<typeof suiteRunSchema>

export const suiteRunsResponseSchema = z.object({
  runs: z.array(suiteRunSchema)
})

export type SuiteRunsResponse = z.output<typeof suiteRunsResponseSchema>
