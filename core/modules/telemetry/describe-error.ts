export interface DescribedError {
  message: string
  stack?: string
}

function textOf(value: unknown): string {
  return value instanceof Error ? value.stack ?? value.message : String(value)
}

/** A mensagem e o stack de um erro, com a cadeia de causas no fim do stack. */
export function describeError(error: unknown): DescribedError {
  if (!(error instanceof Error)) return { message: String(error), stack: undefined }

  const seen = new Set<unknown>([error])
  const lines = [error.stack ?? error.message]
  let cause: unknown = error.cause

  while (cause !== undefined && !seen.has(cause)) {
    seen.add(cause)
    lines.push(`Causado por: ${textOf(cause)}`)
    cause = cause instanceof Error ? cause.cause : undefined
  }

  if (cause !== undefined) lines.push(`Causado por: ${textOf(cause)}`)

  return { message: error.message, stack: lines.join('\n') }
}
