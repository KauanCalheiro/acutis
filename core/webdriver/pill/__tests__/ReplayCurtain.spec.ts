// @vitest-environment jsdom
/** A cortina que segura o usuário enquanto a ferramenta refaz os passos gravados. */
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ReplayCurtain from '../ReplayCurtain.vue'
import { useReplay } from '../useReplay'

function host(status: 'idle' | 'running' | 'failed', step: string | null) {
  const decision = vi.fn()
  const win = window as unknown as Record<string, unknown>

  win.__acutisReplayState = vi.fn(async () => ({ status, step }))
  win.__acutisReplayDecision = decision

  return decision
}

afterEach(() => {
  const win = window as unknown as Record<string, unknown>
  delete win.__acutisReplayState
  delete win.__acutisReplayDecision
  useReplay().stopWatching()
})

async function mounted() {
  const wrapper = mount(ReplayCurtain)
  await new Promise(resolve => setTimeout(resolve, 0))
  await wrapper.vm.$nextTick()

  return wrapper
}

describe('ReplayCurtain', () => {
  it('fica fora do caminho quando não há retomada em curso', async () => {
    host('idle', null)
    const wrapper = await mounted()

    expect(wrapper.find('.curtain').exists()).toBe(false)
  })

  it('cobre a página dizendo o passo que está sendo refeito', async () => {
    host('running', 'Clica em "Financeiro"')
    const wrapper = await mounted()

    expect(wrapper.get('.curtain').text()).toContain('Refazendo seus passos')
    expect(wrapper.get('.curtain').text()).toContain('Clica em "Financeiro"')
    expect(wrapper.find('.surface-action').exists()).toBe(false)
  })

  it('mostra o passo que falhou e deixa o usuário assumir dali', async () => {
    const decision = host('failed', 'Clica em "Cancelada"')
    const wrapper = await mounted()

    expect(wrapper.get('.curtain').text()).toContain('Não consegui refazer')
    expect(wrapper.get('.curtain').text()).toContain('Clica em "Cancelada"')

    await wrapper.get('[data-acutis="retomada-assumir"]').trigger('click')

    expect(decision).toHaveBeenCalledWith('resume')
    expect(wrapper.find('.curtain').exists()).toBe(false)
  })

  it('deixa cancelar a retomada em vez de gravar do lugar errado', async () => {
    const decision = host('failed', 'Clica em "Cancelada"')
    const wrapper = await mounted()

    await wrapper.get('[data-acutis="retomada-cancelar"]').trigger('click')

    expect(decision).toHaveBeenCalledWith('cancel')
  })
})
