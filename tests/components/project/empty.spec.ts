import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectEmpty from '~/components/project/empty.vue'

describe('ProjectEmpty', () => {
  it('oferece os dois começos possíveis', async () => {
    const wrapper = await mountSuspended(ProjectEmpty)

    await wrapper.get('[data-testid="projeto-vazio-template"]').trigger('click')
    await wrapper.get('[data-testid="projeto-vazio-git"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['template'], ['git']])
    expect(wrapper.text()).toContain('Nenhum projeto por aqui ainda')
  })
})
