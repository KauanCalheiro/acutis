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
