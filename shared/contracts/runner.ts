import * as z from 'zod'

export const runnerSpecRequestSchema = z.object({
  spec: z.string().default(''),
  baseUrl: z.string().optional(),
  env: z.record(z.string(), z.string()).optional()
})

export type RunnerSpecRequest = z.output<typeof runnerSpecRequestSchema>

export const runnerProjectRequestSchema = z.object({
  path: z.string().default(''),
  spec: z.string().optional(),
  grep: z.string().optional(),
  env: z.record(z.string(), z.string()).optional()
})

export type RunnerProjectRequest = z.output<typeof runnerProjectRequestSchema>
