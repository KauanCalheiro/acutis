import type { ProjectDetail } from '~/types/project'

/** Os estados em que o projeto tem uma sessão gravada em disco. */
const RECORDED = ['configured', 'failing']

/**
 * O arquivo de sessão que a gravação carrega. Nada quando o projeto não gravou login, porque o
 * caminho existe no projeto de qualquer jeito e o gravador recusa arquivo que não está lá, e nada
 * para o cenário que roda fora da sessão.
 */
export function sessionFor(project: ProjectDetail, isPublic = false): string | undefined {
  if (isPublic || !RECORDED.includes(project.auth_status)) return undefined

  return project.storage_state
}
