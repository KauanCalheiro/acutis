import * as z from 'zod'

export const probeRepositoryRequestSchema = z.object({ url: z.string() })
export type ProbeRepositoryRequest = z.input<typeof probeRepositoryRequestSchema>

export const probeRepositoryResponseSchema = z.object({ public: z.boolean() })
export type ProbeRepositoryResponse = z.output<typeof probeRepositoryResponseSchema>
