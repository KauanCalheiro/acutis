import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseEmpty from '~/components/base/empty.vue'

describe('BaseEmpty', () => {
  it('mostra ícone, título e descrição no testid pedido', async () => {
    const wrapper = await mountSuspended(BaseEmpty, {
      props: {
        icon: 'i-ic-round-folder',
        title: 'Nenhum projeto',
        description: 'Crie o primeiro para começar.',
        testid: 'projetos-vazio'
      }
    })

    expect(wrapper.get('[data-testid="projetos-vazio"]').text()).toContain('Nenhum projeto')
    expect(wrapper.text()).toContain('Crie o primeiro para começar.')
  })

  it('omite a descrição quando não há uma', async () => {
    const wrapper = await mountSuspended(BaseEmpty, {
      props: { icon: 'i-ic-round-folder', title: 'Nenhum projeto' }
    })

    expect(wrapper.findAll('p')).toHaveLength(1)
  })
})
