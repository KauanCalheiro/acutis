/**
 * O retorno de interação da tela. Uma chamada por resultado, com a cor e o ícone já resolvidos.
 * Ver `.claude/rules/frontend-feedback.md`.
 */
export function useNotify() {
  const toast = useToast()
  const telemetry = useTelemetry()

  return {
    success(title: string) {
      toast.add({
        title,
        color: 'success',
        icon: 'i-ic-round-check-circle'
      })
    },

    /** O que o servidor explicou; `fallback` só quando ele não explicou nada. */
    failure(error: unknown, fallback: string, context?: string) {
      toast.add({
        title: extractServerError(error, fallback),
        color: 'error',
        icon: 'i-ic-round-error'
      })

      telemetry.report(error, fallback, context).catch(() => false)
    }
  }
}
