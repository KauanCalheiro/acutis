import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import App from '~/app.vue'
import { settle } from './support/modal'

function favicon() {
  return document.head.querySelector<HTMLLinkElement>('link[rel="icon"]')?.getAttribute('href') ?? ''
}

beforeEach(() => {
  // O favicon é repintado com as cores do tema, que o jsdom não calcula sozinho.
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
    callback()

    return 0
  })
  vi.spyOn(globalThis, 'getComputedStyle').mockReturnValue({
    getPropertyValue: (name: string) => name === '--ui-primary' ? '#2563eb' : '#ffffff'
  } as unknown as CSSStyleDeclaration)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('App', () => {
  it('pinta o favicon com as cores do tema e mostra a navegação', async () => {
    const wrapper = await mountSuspended(App)
    await settle()

    expect(wrapper.find('[data-testid="navbar-logo"]').exists()).toBe(true)
    expect(decodeURIComponent(favicon())).toContain('#2563eb')
  })

  it('espera o tema aparecer antes de desistir de repintar', async () => {
    const frames: (() => void)[] = []

    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => {
      frames.push(callback)

      return frames.length
    })

    await mountSuspended(App)
    await settle()

    // O tema ainda não trocou as cores: o repintado é igual ao atual, e ele tenta de novo depois.
    useAppConfig().ui.colors.primary = 'red'
    await settle()
    const pedidos = frames.length

    frames.forEach(frame => frame())

    expect(pedidos).toBeGreaterThan(0)
    expect(decodeURIComponent(favicon())).toContain('#2563eb')
  })

  it('repinta o favicon quando a cor primária muda', async () => {
    await mountSuspended(App)
    await settle()

    ;(getComputedStyle as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
      getPropertyValue: (name: string) => name === '--ui-primary' ? '#16a34a' : '#000000'
    })

    useAppConfig().ui.colors.primary = 'green'
    await settle()

    expect(decodeURIComponent(favicon())).toContain('#16a34a')
  })
})
