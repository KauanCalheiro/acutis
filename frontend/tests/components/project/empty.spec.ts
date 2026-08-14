import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime'
import ProjectEmpty from '~/components/project/empty.vue'
import { GIT_OFF_HINT } from '~/composables/capabilities'

// ponytail: objeto simples em vez de ref — `vi.hoisted` roda antes dos auto-imports do Nuxt, e
// cada teste monta o componente do zero, então não há o que reagir.
const host = vi.hoisted(() => ({ git: true }))

mockNuxtImport('useGit', () => () => ({ available: host.git }))

describe('ProjectEmpty', () => {
  it('lets the user pick either origin when git is installed', async () => {
    host.git = true

    const wrapper = await mountSuspended(ProjectEmpty)

    await wrapper.get('[data-testid="projeto-vazio-git"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['git']])
  })

  /**
   * Sem git na máquina o clone estoura no backend, então o caminho fica desabilitado com o motivo à
   * vista — nunca escondido, senão o usuário não descobre que o recurso existe.
   */
  it('disables the git origin and explains why when git is missing', async () => {
    host.git = false

    const wrapper = await mountSuspended(ProjectEmpty)

    await wrapper.get('[data-testid="projeto-vazio-git"]').trigger('click')

    expect(wrapper.emitted('select')).toBeUndefined()
    expect(wrapper.text()).toContain(GIT_OFF_HINT)
  })

  it('keeps the template origin working without git', async () => {
    host.git = false

    const wrapper = await mountSuspended(ProjectEmpty)

    await wrapper.get('[data-testid="projeto-vazio-template"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['template']])
  })
})
