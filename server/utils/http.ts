import { createError, readBody } from 'h3'
import type { H3Event } from 'h3'
import { HttpError, ValidationFailed } from '@acutis/core/common/exceptions/errors.js'
import type * as z from 'zod'

function validationErrors(issues: z.core.$ZodIssue[]): Record<string, string[]> {
  const errors: Record<string, string[]> = {}

  for (const issue of issues) {
    const path = issue.path.join('.')

    if (errors[path] === undefined) {
      errors[path] = [issue.message]
    }
  }

  return errors
}

export async function validatedBody<T>(event: H3Event, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      data: {
        message: 'Os dados informados são inválidos.',
        errors: validationErrors(parsed.error.issues)
      }
    })
  }

  return parsed.data
}

export async function execute<T>(operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof HttpError)) throw error

    throw createError({
      statusCode: error.status,
      data: {
        message: error.message,
        ...(error instanceof ValidationFailed ? { errors: error.errors } : {})
      }
    })
  }
}
