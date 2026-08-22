import * as z from 'zod'
import { recordedEventSchema, recorderEventSchema } from './recording'

export const scenarioSchema = z.object({
  title: z.string(),
  spec: z.string(),
  feature: z.string().nullable(),
  tags: z.array(z.string()),
  domain: z.string().nullable()
})

export type Scenario = z.output<typeof scenarioSchema>

export const scenarioRunStepSchema = z.object({
  title: z.string(),
  status: z.enum(['waiting', 'running', 'success', 'failed']),
  duration_ms: z.number(),
  error: z.string().nullable()
})

export type ScenarioRunStep = z.output<typeof scenarioRunStepSchema>

export const scenarioRunSchema = z.object({
  started_at: z.string(),
  duration_ms: z.number(),
  passed: z.boolean(),
  branch: z.string().nullable(),
  author: z.string().nullable(),
  steps: z.array(scenarioRunStepSchema),
  playwright: z.string(),
  video_path: z.string().nullable()
})

export type ScenarioRun = z.output<typeof scenarioRunSchema>

export const scenarioDetailSchema = scenarioSchema.extend({
  playwright: z.string(),
  gherkin: z.string().nullable(),
  events: z.array(recorderEventSchema),
  updated_at: z.string(),
  is_auth: z.boolean(),
  runs: z.array(scenarioRunSchema)
})

export type ScenarioDetail = z.output<typeof scenarioDetailSchema>

export const updateScenarioRequestSchema = z.object({
  title: z.string().min(1, 'O título do cenário é obrigatório.').max(120),
  path: z.string().min(1, 'O caminho do arquivo é obrigatório.').max(80),
  domain: z.string().max(80).nullable().optional(),
  gherkin: z.string().nullable().optional(),
  playwright: z.string().min(1, 'O teste Playwright é obrigatório.'),
  tags: z.array(z.string()).optional(),
  /** A gravação que originou este teste. Vem quando ela foi retomada e agora tem outros passos. */
  events: z.array(recordedEventSchema).optional()
})

export type UpdateScenarioRequest = z.input<typeof updateScenarioRequestSchema>

export const scenarioFixRequestSchema = z.object({
  step: z.string().min(1, 'O passo que falhou é obrigatório.'),
  error: z.string().min(1, 'O erro da execução é obrigatório.')
})

export type ScenarioFixRequest = z.input<typeof scenarioFixRequestSchema>
export const scenarioFixBffRequestSchema = scenarioFixRequestSchema.extend({ scenarioId: z.string().min(1) })
export type ScenarioFixBffRequest = z.input<typeof scenarioFixBffRequestSchema>
export const scenarioSuggestionsRequestSchema = z.object({ scenarioId: z.string().min(1) })
export type ScenarioSuggestionsRequest = z.input<typeof scenarioSuggestionsRequestSchema>

export const fixedSpecSchema = z.object({
  playwright: z.string(),
  summary: z.string()
})

export type FixedSpec = z.output<typeof fixedSpecSchema>

export const selectorSuggestionSchema = z.object({
  event: z.string(),
  currentSelector: z.string(),
  suggestedTestId: z.string(),
  reason: z.string()
})

export type SelectorSuggestion = z.output<typeof selectorSuggestionSchema>

export const runProjectRequestSchema = z.object({
  spec: z.string().optional(),
  grep: z.string().optional()
}).passthrough()

export type RunProjectRequest = z.input<typeof runProjectRequestSchema>

export const runProjectResponseSchema = z.object({
  passed: z.boolean(),
  output: z.string()
})

export type RunProjectResponse = z.output<typeof runProjectResponseSchema>

export type RunTimelineStep = {
  title: string
  status: 'waiting' | 'running' | 'success' | 'failed'
  error?: string | null
  testId?: string
  order?: number
}

export type RunTest = {
  id: string
  title: string
  status: RunTimelineStep['status']
  error: string | null
  steps: RunTimelineStep[]
}

export type RunStreamEvent = {
  event: 'run:started' | 'step' | 'test' | 'run:finished'
  id?: string
  testId?: string
  title: string
  status: 'pending' | 'success' | 'failed' | 'skipped'
  steps?: string[]
  error?: string | null
  videoPath?: string | null
  passed: boolean
  output?: string
}
