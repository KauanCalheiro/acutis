import type { ErrorReportResponse } from '#shared/contracts/telemetry'
import { extractServerError } from '~/utils/api-error'

/** O stack do servidor, que explica a falha, na frente do stack do `$fetch` no browser. */
function stackOf(error: unknown): string | undefined {
  const doServidor = (error as { data?: { data?: { stack?: string } } }).data?.data?.stack

  return doServidor ?? (error instanceof Error ? error.stack : undefined)
}

/** O envio de um relato de erro, que o servidor só repassa quando a pessoa consentiu. */
export function useTelemetry() {
  return {
    async report(error: unknown, fallback: string, context?: string): Promise<boolean> {
      try {
        const response = await $fetch<ErrorReportResponse>('/api/telemetry/report', {
          method: 'POST',
          body: {
            message: extractServerError(error, fallback),
            stack: stackOf(error),
            context
          }
        })

        return response.sent
      } catch {
        return false
      }
    }
  }
}
