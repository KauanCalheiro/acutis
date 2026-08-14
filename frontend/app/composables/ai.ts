/** A chave do cache, para a tela de configuração recarregar isto depois de salvar. */
export const AI_SETTINGS_KEY = 'ai-settings'

/** O texto do tooltip do botão desabilitado, um só para não explicar a mesma coisa de dois jeitos. */
export const AI_OFF_HINT = 'Configure um provedor de IA para usar isto'

/**
 * Se existe provedor de IA ativo. Quem chama modelo consulta isto: o botão fica desabilitado com o
 * motivo no tooltip, nunca escondido — sumir com o botão esconde também que o recurso existe.
 */
export function useAi() {
  const { data } = useFetch<{ configured: boolean }>('/api/settings/ai', {
    key: AI_SETTINGS_KEY
  })

  return {
    configured: computed(() => data.value?.configured ?? false)
  }
}
