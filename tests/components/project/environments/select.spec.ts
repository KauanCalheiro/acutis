import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import ProjectEnvironmentsSelect from '~/components/project/environments/select.vue'
import { mountInApp } from '../../../support/app'
import { settle } from '../../../support/modal'
import type { EnvironmentList } from '~/types/project'

function environment(slug: string, name: string) {
  return { slug, name, vars: [] }
}

function list(...environments: ReturnType<typeof environment>[]) {
  return { active: 'homologacao', known_keys: [], environments } as unknown as EnvironmentList
}

// O useFetch guarda o resultado pela chave do projeto, então cada cenário tem o seu slug.
const api = { activated: null as string | null }

registerEndpoint('/api/projects/solo/environments', () => list(environment('homologacao', 'Homologação')))

registerEndpoint('/api/projects/alpha-store/environments', () =>
  list(environment('desenvolvimento', 'Desenvolvimento'), environment('homologacao', 'Homologação')))

registerEndpoint('/api/projects/alpha-store/environments/desenvolvimento/activate', {
  method: 'POST',
  handler: () => {
    api.activated = 'desenvolvimento'

    return { ok: true }
  }
})

beforeEach(() => {
  api.activated = null
})

function mount(slug: string) {
  return mountInApp(ProjectEnvironmentsSelect, { props: { slug } })
}

describe('ProjectEnvironmentsSelect', () => {
  it('vira um atalho para editar quando só existe um ambiente', async () => {
    const wrapper = await mount('solo')

    expect(wrapper.get('[data-testid="projeto-ambientes"]').text()).toContain('Homologação')

    await wrapper.get('[data-testid="projeto-ambientes"]').trigger('click')
    expect(wrapper.findComponent(ProjectEnvironmentsSelect).emitted('edit')).toHaveLength(1)
  })

  it('mostra o seletor quando há mais de um ambiente', async () => {
    const wrapper = await mount('alpha-store')

    expect(wrapper.find('[data-testid="projeto-ambiente-ativo"]').exists()).toBe(true)
  })

  it('leva à edição pelo atalho ao lado do seletor', async () => {
    const wrapper = await mount('alpha-store')

    await wrapper.get('[data-testid="projeto-ambientes"]').trigger('click')

    expect(wrapper.findComponent(ProjectEnvironmentsSelect).emitted('edit')).toHaveLength(1)
  })

  it('ativa o ambiente escolhido e avisa a tela', async () => {
    const wrapper = await mount('alpha-store')
    const select = wrapper.findAllComponents({ name: 'USelectMenu' }).at(-1)!

    select.vm.$emit('update:modelValue', 'desenvolvimento')
    await settle()

    expect(api.activated).toBe('desenvolvimento')
    expect(wrapper.findComponent(ProjectEnvironmentsSelect).emitted('activated')).toHaveLength(1)
  })

  it('não faz nada quando o ambiente escolhido já é o ativo', async () => {
    const wrapper = await mount('alpha-store')
    const select = wrapper.findAllComponents({ name: 'USelectMenu' }).at(-1)!

    select.vm.$emit('update:modelValue', 'homologacao')
    select.vm.$emit('update:modelValue', undefined)
    await settle()

    expect(api.activated).toBeNull()
    expect(wrapper.findComponent(ProjectEnvironmentsSelect).emitted('activated')).toBeUndefined()
  })
})
