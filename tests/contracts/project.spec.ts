import { describe, expect, it } from 'vitest'
import { projectDetailSchema, projectsResponseSchema } from '#shared/contracts/project'
import { authSetupSchema } from '#shared/contracts/auth'
import { environmentListSchema } from '#shared/contracts/environment'
import { testDraftSchema } from '#shared/contracts/generation'
import { probeRepositoryResponseSchema } from '#shared/contracts/git'
import { recorderEventSchema } from '#shared/contracts/recording'
import { scenarioDetailSchema } from '#shared/contracts/scenario'
import { aiSettingsSchema } from '#shared/contracts/settings'

describe('contrato de projetos', () => {
  it('expõe schemas para todos os domínios HTTP', () => {
    expect([
      authSetupSchema,
      environmentListSchema,
      testDraftSchema,
      probeRepositoryResponseSchema,
      recorderEventSchema,
      scenarioDetailSchema,
      aiSettingsSchema
    ]).toHaveLength(7)
  })

  it('aceita a resposta compartilhada pela API e pelo frontend', () => {
    const project = projectDetailSchema.parse({
      name: 'Alpha Store',
      slug: 'alpha-store',
      path: '/tmp/alpha-store',
      repository: null,
      provider: null,
      branch: null,
      created_at: '2026-08-16T00:00:00.000Z',
      updated_at: '2026-08-16T00:00:00.000Z',
      scenarios: [],
      auth_status: 'unset',
      base_url: null,
      storage_state: '/tmp/alpha-store/storage-state.json',
      requires_url: true,
      vscode_url: 'vscode://file/tmp/alpha-store',
      has_report: false
    })

    expect(projectsResponseSchema.parse({
      data: [
        project
      ],
      meta: {
        current_page: 1,
        per_page: 1,
        total: 1
      }
    }).data[0]?.slug).toBe('alpha-store')
  })
})
