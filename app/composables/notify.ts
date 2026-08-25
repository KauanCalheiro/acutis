/** Quanto a toast de erro fica na tela, o dobro largo do padrão para dar tempo de enviar os logs. */
const ERROR_DURATION = 15_000

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
        icon: 'i-ic-round-error',
        duration: ERROR_DURATION,
        actions: telemetry.enabled
          ? [{
              label: 'Enviar logs',
              color: 'neutral',
              variant: 'soft',
              block: true,
              icon: 'i-ic-round-cloud-upload',
              onClick: async () => {
                const sent = await telemetry.report(error, fallback, context).catch(() => false)

                toast.add(sent
                  ? { title: 'Logs enviados. Obrigado.', color: 'success', icon: 'i-ic-round-check-circle' }
                  : { title: 'Não foi possível enviar os logs.', color: 'warning', icon: 'i-ic-round-warning' })
              }
            }]
          : undefined
      })
    }
  }
}
