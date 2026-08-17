import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseLoadingPhrases from '~/components/base/loading/phrases.vue'

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('BaseLoadingPhrases', () => {
  it('começa na primeira frase, com a dica padrão', async () => {
    const wrapper = await mountSuspended(BaseLoadingPhrases, {
      props: { phrases: ['Lendo a tela', 'Escrevendo o teste'] }
    })

    expect(wrapper.text()).toContain('Lendo a tela')
    expect(wrapper.text()).toContain('Isso pode levar alguns segundos.')
  })

  it('embaralha até revelar a frase seguinte', async () => {
    const wrapper = await mountSuspended(BaseLoadingPhrases, {
      props: { phrases: ['Lendo a tela', 'Escrevendo o teste'], hint: 'Já vai' }
    })

    await vi.advanceTimersByTimeAsync(1200 + 50 * 5)
    expect(wrapper.text()).not.toContain('Lendo a tela')

    const seen: string[] = []
    for (let step = 0; step < 60; step++) {
      await vi.advanceTimersByTimeAsync(50)
      seen.push(wrapper.text())
    }

    expect(seen.some(text => text.includes('Escrevendo o teste'))).toBe(true)
    expect(wrapper.text()).toContain('Já vai')
  })

  it('para o embaralhamento quando some da tela', async () => {
    const wrapper = await mountSuspended(BaseLoadingPhrases, {
      props: { phrases: ['Lendo a tela', 'Escrevendo o teste'] }
    })

    await vi.advanceTimersByTimeAsync(1200)
    wrapper.unmount()

    // O laço segue vivo dentro de um `await`; ele tem que encerrar sem estourar erro nenhum.
    await expect(vi.advanceTimersByTimeAsync(50 * 60)).resolves.toBeDefined()
  })
})
