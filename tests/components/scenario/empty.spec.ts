import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioEmpty from '~/components/scenario/empty.vue'

describe('ScenarioEmpty', () => {
  it('convida a gravar o primeiro cenário', async () => {
    const wrapper = await mountSuspended(ScenarioEmpty)

    await wrapper.get('[data-testid="cenario-vazio-gravar"]').trigger('click')

    expect(wrapper.text()).toContain('Nenhum cenário ainda')
    expect(wrapper.emitted('record')).toHaveLength(1)
  })

  it('não grava enquanto o convite está desabilitado', async () => {
    const wrapper = await mountSuspended(ScenarioEmpty, { props: { disabled: true } })

    await wrapper.get('[data-testid="cenario-vazio-gravar"]').trigger('click')

    expect(wrapper.emitted('record')).toBeUndefined()
    expect(wrapper.get('[data-testid="cenario-vazio-gravar"]').classes()).toContain('opacity-50')
  })
})

describe('ScenarioEmpty: projeto sem autenticação configurada', () => {
  it('convida a gravar o login, que é o que vem antes de qualquer cenário autenticado', async () => {
    const wrapper = await mountSuspended(ScenarioEmpty, { props: { needsLogin: true } })

    expect(wrapper.text()).toContain('Gravar o login')
    expect(wrapper.find('[data-testid="cenario-vazio-login"]').exists()).toBe(true)
  })

  it('pede a gravação do login ao clique', async () => {
    const wrapper = await mountSuspended(ScenarioEmpty, { props: { needsLogin: true } })

    await wrapper.get('[data-testid="cenario-vazio-login"]').trigger('click')

    expect(wrapper.emitted('login')).toHaveLength(1)
    expect(wrapper.emitted('record')).toBeUndefined()
  })

  it('deixa dizer que o sistema não tem login', async () => {
    const wrapper = await mountSuspended(ScenarioEmpty, { props: { needsLogin: true } })

    await wrapper.get('[data-testid="cenario-vazio-sem-login"]').trigger('click')

    expect(wrapper.emitted('skip')).toHaveLength(1)
  })

  it('volta a convidar para o cenário quando o login já está configurado', async () => {
    const wrapper = await mountSuspended(ScenarioEmpty)

    expect(wrapper.find('[data-testid="cenario-vazio-login"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cenario-vazio-sem-login"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="cenario-vazio-gravar"]').text()).toContain('Gravar cenário')
  })
})
