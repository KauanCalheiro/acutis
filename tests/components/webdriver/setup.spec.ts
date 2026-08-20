import { afterEach, describe, expect, it, vi } from 'vitest'
import WebdriverSetup from '~/components/webdriver/setup.vue'
import { mountInApp } from '../../support/app'

const writeText = vi.fn().mockResolvedValue(undefined)

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function withAgent(userAgent: string) {
  vi.stubGlobal('navigator', { userAgent, clipboard: { writeText } })
}

describe('WebdriverSetup', () => {
  it('sugere o comando do macOS por padrão', async () => {
    withAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    const wrapper = await mountInApp(WebdriverSetup)

    expect(wrapper.get('[data-testid="webdriver-comando"]').text()).toContain('open -na "Google Chrome"')
  })

  it('troca para o comando do Windows quando o navegador é de lá', async () => {
    withAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')
    const wrapper = await mountInApp(WebdriverSetup)

    expect(wrapper.get('[data-testid="webdriver-comando"]').text()).toContain('Start-Process "chrome"')
  })

  it('cai no Linux quando o navegador não é Mac nem Windows', async () => {
    withAgent('Mozilla/5.0 (X11; Linux x86_64)')
    const wrapper = await mountInApp(WebdriverSetup)

    expect(wrapper.get('[data-testid="webdriver-comando"]').text()).toContain('google-chrome --remote-debugging-port')
  })

  it('troca de sistema pela aba', async () => {
    withAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    const wrapper = await mountInApp(WebdriverSetup)

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'linux')
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(wrapper.get('[data-testid="webdriver-comando"]').text()).toContain('google-chrome')
  })

  it('copia o comando e volta o botão ao normal depois de avisar', async () => {
    vi.useFakeTimers()
    withAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    const wrapper = await mountInApp(WebdriverSetup)

    await wrapper.get('[data-testid="webdriver-copiar"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('--remote-debugging-port=9222'))
    expect(wrapper.get('[data-testid="webdriver-copiar"]').attributes('aria-label')).toBe('Copiado!')

    await vi.advanceTimersByTimeAsync(2000)
    expect(wrapper.get('[data-testid="webdriver-copiar"]').attributes('aria-label')).toBe('Copiar comando')
  })
})
