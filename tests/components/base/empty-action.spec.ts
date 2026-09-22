import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseEmptyAction from '~/components/base/empty/action.vue'

function props(overrides: Record<string, unknown> = {}) {
  return {
    icon: 'i-ic-round-lock',
    title: 'Gravar o login',
    description: 'Abre o navegador para você entrar no sistema uma vez.',
    testid: 'auth-gravar-vazio',
    ...overrides
  }
}

describe('BaseEmptyAction', () => {
  it('mostra o convite com título e descrição', async () => {
    const wrapper = await mountSuspended(BaseEmptyAction, { props: props() })

    expect(wrapper.text()).toContain('Gravar o login')
    expect(wrapper.text()).toContain('Abre o navegador')
  })

  it('avisa o clique de quem o abriu', async () => {
    const wrapper = await mountSuspended(BaseEmptyAction, { props: props() })

    await wrapper.get('[data-testid="auth-gravar-vazio"]').trigger('click')

    expect(wrapper.emitted('click')).toHaveLength(1)
  })

  it('não reage enquanto está desabilitado', async () => {
    const wrapper = await mountSuspended(BaseEmptyAction, { props: props({ disabled: true }) })

    await wrapper.get('[data-testid="auth-gravar-vazio"]').trigger('click')

    expect(wrapper.emitted('click')).toBeUndefined()
    expect(wrapper.get('[data-testid="auth-gravar-vazio"]').classes()).toContain('opacity-50')
  })
})
