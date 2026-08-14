/** A chave do cache, para as telas que perguntam isto não repetirem a consulta. */
export const CAPABILITIES_KEY = 'capabilities'

/** O texto do aviso do caminho desabilitado, um só para não explicar a mesma coisa de dois jeitos. */
export const GIT_OFF_HINT = 'Instale o git nesta máquina para importar de um repositório'

/**
 * Se esta máquina tem git. Quem oferece clonar consulta isto: o caminho fica desabilitado com o
 * motivo à vista, nunca escondido — sumir com a opção esconde também que o recurso existe, a mesma
 * decisão tomada em [useAi](./ai.ts).
 *
 * Enquanto a resposta não chega, vale disponível. É o oposto do padrão do `useAi`, e de propósito:
 * git existe na esmagadora maioria das máquinas, então supor ausência faria a opção piscar
 * desabilitada em toda abertura de tela. Errar para o lado otimista custa, no pior caso, o mesmo
 * erro de clone que já existe hoje.
 */
export function useGit() {
  const { data } = useFetch<{ git: boolean }>('/api/settings/capabilities', {
    key: CAPABILITIES_KEY
  })

  return {
    available: computed(() => data.value?.git ?? true)
  }
}
