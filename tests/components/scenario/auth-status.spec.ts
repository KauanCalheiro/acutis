import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioAuthStatus from '~/components/scenario/auth-status.vue'

async function badge(status: string) {
  const wrapper = await mountSuspended(ScenarioAuthStatus, { props: { status } })

  return wrapper.find('[data-testid="cenario-auth-status"]')
}

describe('ScenarioAuthStatus', () => {
  it('nomeia cada estado da autenticação', async () => {
    expect((await badge('configured')).text()).toBe('Configurada')
    expect((await badge('failing')).text()).toBe('Falhando')
    expect((await badge('skipped')).text()).toBe('Dispensada')
  })

  it('some quando a autenticação nem foi tratada', async () => {
    expect((await badge('unset')).exists()).toBe(false)
  })
})
