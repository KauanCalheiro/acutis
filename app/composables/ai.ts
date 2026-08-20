/** A chave do cache, para a tela de configuração recarregar isto depois de salvar. */
export const AI_SETTINGS_KEY = 'ai-settings'

/** O texto do tooltip do botão desabilitado, um só para não explicar a mesma coisa de dois jeitos. */
export const AI_OFF_HINT = 'Configure um provedor de IA para usar isto'

/** Se existe provedor de IA ativo. */
export function useAi() {
  const { data } = useFetch<import('#shared/contracts/settings').AiSettings>('/api/settings/ai', {
    key: AI_SETTINGS_KEY
  })

  return {
    configured: computed(() => data.value?.configured ?? false)
  }
}
