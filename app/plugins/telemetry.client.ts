/** Relata o erro da interface que escapou de qualquer tratamento. */
export default defineNuxtPlugin((nuxtApp) => {
  const telemetry = useTelemetry()

  for (const hook of ['vue:error', 'app:error'] as const) {
    nuxtApp.hook(hook, (error: unknown) => {
      telemetry.report(error, 'Erro na interface', hook).catch(() => false)
    })
  }
})
