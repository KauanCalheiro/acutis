// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const launch = vi.fn()

vi.mock('playwright', () => ({
  chromium: {
    launch,
    connectOverCDP: vi.fn()
  }
}))

const { RecorderService } = await import('../recorder.service.js')

function recorder() {
  const videoService = { ensureDir: vi.fn().mockResolvedValue(undefined) }

  return new RecorderService(videoService as never)
}

function start(service: InstanceType<typeof RecorderService>) {
  return service.start(() => {}, () => {}, () => {})
}

describe('RecorderService.start', () => {
  beforeEach(() => {
    launch.mockReset()
  })

  it('explains how to install the browser when Chromium is missing from the Playwright cache', async () => {
    launch.mockRejectedValue(new Error(
      'browserType.launch: Executable doesn\'t exist at /home/rosa/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome'
    ))

    await expect(start(recorder())).rejects.toThrow('npx playwright install chromium')
  })

  it('keeps the original failure when the browser fails for another reason', async () => {
    launch.mockRejectedValue(new Error('browserType.launch: Target page, context or browser has been closed'))

    await expect(start(recorder())).rejects.toThrow('Target page, context or browser has been closed')
  })
})
