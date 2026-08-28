/**
 * A sincronização com o repositório do projeto, que acontece sozinha e não aparece em lugar nenhum
 * enquanto dá certo. O conflito é a única coisa que a tela mostra, e só como marca no atalho do
 * editor: resolver é no console git, dentro dele.
 */
import type { ProjectSync } from '~/types/project'

export function useGitSync(slug: string) {
  const state = useState<ProjectSync>(`git-sync-${slug}`, () => ({ status: 'synced', changed: false }))
  const syncing = ref(false)
  let inFlight: Promise<ProjectSync | null> | null = null

  function sync(): Promise<ProjectSync | null> {
    if (inFlight) return inFlight

    syncing.value = true
    inFlight = $fetch<ProjectSync>(`/api/projects/${slug}/git/sync`, { method: 'POST' })
      .then((result) => {
        // Indisponibilidade não prova que um conflito conhecido foi resolvido.
        if (result.status !== 'unavailable' || state.value.status !== 'conflict') state.value = result
        return result
      })
      .catch(() => {
        if (state.value.status !== 'conflict') {
          state.value = { status: 'unavailable', changed: false, reason: 'network' }
        }
        return null
      })
      .finally(() => {
        syncing.value = false
        inFlight = null
      })

    return inFlight
  }

  return {
    state,
    syncing,
    conflict: computed(() => state.value.status === 'conflict'),
    unavailable: computed(() => state.value.status === 'unavailable'),
    sync
  }
}

/**
 * Serve aos dois casos que o acutis não resolve sozinho: o mesmo arquivo mudou dos dois lados, ou
 * há alteração aqui que ninguém commitou, e o rebase não passa por cima dela.
 */
export const GIT_CONFLICT_HINT = 'O repositório precisa de você: há conflito ou alteração sem commit. '
  + 'Abra o projeto no VS Code e resolva pelo console do git.'

export const GIT_UNAVAILABLE_HINT = 'O projeto continua disponível, mas o repositório remoto não respondeu. '
  + 'Confira a rede ou as credenciais do Git; a sincronização tentará novamente na próxima ação.'
