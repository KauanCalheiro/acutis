import { describe, it, expect, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import ScenarioCard from '~/components/scenario/card.vue'
import { mountInApp } from '../../support/app'
import type { Scenario } from '~/types/project'

interface MenuItem {
  label: string
  testid?: string
  onSelect?: () => unknown
}

const navigate = vi.hoisted(() => vi.fn())

mockNuxtImport('navigateTo', () => navigate)

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    title: 'Pagar com cartão',
    spec: 'tests/checkout/pagar.spec.ts',
    feature: null,
    tags: ['@write'],
    domain: 'checkout',
    skipped: false,
    ...overrides
  }
}

async function mount(overrides: Partial<Scenario> = {}) {
  navigate.mockClear()

  return mountInApp(ScenarioCard, {
    props: {
      scenario: scenario(overrides),
      slug: 'alpha-store'
    }
  })
}

function items(wrapper: Awaited<ReturnType<typeof mount>>) {
  return (wrapper.findComponent({ name: 'UContextMenu' }).props('items') as MenuItem[][]).flat()
}

function item(wrapper: Awaited<ReturnType<typeof mount>>, testid: string) {
  return items(wrapper).find(entry => entry.testid === testid)!
}

describe('ScenarioCard', () => {
  it('mostra título, arquivo e tags', async () => {
    const wrapper = await mount()

    expect(wrapper.text()).toContain('Pagar com cartão')
    expect(wrapper.text()).toContain('tests/checkout/pagar.spec.ts')
    expect(wrapper.text()).toContain('@write')
  })

  it('abre o cenário ao clicar no card', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-card"]').trigger('click')

    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store/scenarios/checkout/pagar')
  })

  it('marca o cenário pausado', async () => {
    const wrapper = await mount({ skipped: true })

    expect(wrapper.get('[data-testid="cenario-card-pulado"]').text()).toContain('Pausado')
  })

  it('abre o cenário, as execuções e a edição pelo menu', async () => {
    const wrapper = await mount()

    item(wrapper, 'cenario-menu-abrir').onSelect!()
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store/scenarios/checkout/pagar')

    item(wrapper, 'cenario-menu-execucao').onSelect!()
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store/scenarios/checkout/pagar?tab=execucoes&run=ultima')

    item(wrapper, 'cenario-menu-editar').onSelect!()
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store/scenarios/checkout/pagar?editar')
  })

  it('pede para a tela rodar, pausar e remover o cenário', async () => {
    const wrapper = await mount()
    const card = wrapper.findComponent(ScenarioCard)

    item(wrapper, 'cenario-menu-rodar').onSelect!()
    item(wrapper, 'cenario-menu-pausar').onSelect!()
    item(wrapper, 'cenario-menu-remover').onSelect!()

    expect(card.emitted('run')).toHaveLength(1)
    expect(card.emitted('skip')).toHaveLength(1)
    expect(card.emitted('remove')).toHaveLength(1)
  })

  it('oferece voltar a rodar o cenário que está pulado', async () => {
    const wrapper = await mount({ skipped: true })

    expect(item(wrapper, 'cenario-menu-pausar').label).toBe('Voltar a rodar')
    expect(items(wrapper).find(entry => entry.testid === 'cenario-menu-rodar')).toBeUndefined()
  })
})
