import { createError } from 'h3'
import type * as z from 'zod'

export function parseApiResponse<T>(schema: z.ZodType<T>, response: unknown): T {
  const parsed = schema.safeParse(response)

  if (!parsed.success) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Resposta inválida da API.'
    })
  }

  return parsed.data
}
