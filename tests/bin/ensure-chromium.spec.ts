// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ensureChromium } from '../../bin/ensure-chromium.js'

describe('ensureChromium', () => {
  it('keeps the browser cache untouched when Chromium is already installed', async () => {
    const install = vi.fn()
    const log = vi.fn()

    const installed = await ensureChromium({
      executablePath: async () => '/cache/chromium',
      exists: () => true,
      install,
      log
    })

    expect(installed).toBe(false)
    expect(install).not.toHaveBeenCalled()
    expect(log).not.toHaveBeenCalled()
  })

  it('downloads Chromium when the Playwright cache is empty', async () => {
    const install = vi.fn().mockResolvedValue(0)
    const log = vi.fn()

    const installed = await ensureChromium({
      executablePath: async () => '/cache/chromium',
      exists: () => false,
      install,
      log
    })

    expect(installed).toBe(true)
    expect(install).toHaveBeenCalledOnce()
    expect(log).toHaveBeenCalledWith('baixando o Chromium do Playwright (só na primeira execução)')
  })

  it('reports how to recover when the Chromium download fails', async () => {
    await expect(ensureChromium({
      executablePath: async () => '/cache/chromium',
      exists: () => false,
      install: async () => 1,
      log: () => {}
    })).rejects.toThrow('npx playwright install chromium')
  })
})
