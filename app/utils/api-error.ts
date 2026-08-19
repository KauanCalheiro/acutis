interface ServerErrorPayload {
  message?: string
  errors?: Record<string, string[]>
}

export function extractServerError(error: unknown, fallback: string): string {
  const err = error as { data?: { data?: ServerErrorPayload } }
  const errors = err.data?.data?.errors

  return errors?.[Object.keys(errors)[0] ?? '']?.[0]
    ?? err.data?.data?.message
    ?? fallback
}
