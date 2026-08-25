import * as z from 'zod'

export const errorReportRequestSchema = z.object({
  message: z.string().min(1).max(2_000),
  stack: z.string().max(20_000).optional(),
  context: z.string().max(500).optional()
})
export type ErrorReportRequest = z.input<typeof errorReportRequestSchema>

export const errorReportResponseSchema = z.object({ sent: z.boolean() })
export type ErrorReportResponse = z.output<typeof errorReportResponseSchema>
