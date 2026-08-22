import { describe, expect, it } from 'vitest'
import type { ProjectDetail } from '~/types/project'
import { sessionFor } from '~/utils/recording-session'

function project(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    auth_status: 'configured',
    storage_state: '/tmp/storage-state.json',
    ...overrides
  } as ProjectDetail
}

describe('sessionFor', () => {
  it('carrega a sessão do projeto que tem login gravado', () => {
    expect(sessionFor(project())).toBe('/tmp/storage-state.json')
    expect(sessionFor(project({ auth_status: 'failing' }))).toBe('/tmp/storage-state.json')
  })

  it('não carrega sessão nenhuma quando o projeto não tem login gravado', () => {
    expect(sessionFor(project({ auth_status: 'unset' }))).toBeUndefined()
    expect(sessionFor(project({ auth_status: 'skipped' }))).toBeUndefined()
  })

  it('não carrega sessão para o cenário que roda fora dela', () => {
    expect(sessionFor(project(), true)).toBeUndefined()
  })
})
