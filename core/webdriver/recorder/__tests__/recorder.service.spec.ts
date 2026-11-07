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

/** A browser double that opens one page already at the recording size. */
function fakeBrowser() {
  const page = {
    evaluate: vi.fn().mockResolvedValue({ innerWidth: 1280, innerHeight: 720, outerWidth: 1280, outerHeight: 720 }),
    exposeFunction: vi.fn().mockResolvedValue(undefined),
    on: vi.fn(),
    url: vi.fn(() => 'about:blank'),
    isClosed: vi.fn(() => false),
    close: vi.fn().mockResolvedValue(undefined),
    screencast: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined) }
  }
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    addInitScript: vi.fn().mockResolvedValue(undefined),
    storageState: vi.fn().mockResolvedValue({ cookies: [], origins: [] }),
    close: vi.fn().mockResolvedValue(undefined)
  }

  return {
    newContext: vi.fn().mockResolvedValue(context),
    on: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined)
  }
}

describe('RecorderService: uma instância só', () => {
  beforeEach(() => {
    launch.mockReset()
    launch.mockImplementation(async () => fakeBrowser())
  })

  /** A recorder whose video storage and injected bundle are doubles. */
  function openableRecorder() {
    const videoService = {
      ensureDir: vi.fn().mockResolvedValue(undefined),
      path: vi.fn((sessionId: string) => `/tmp/${sessionId}.webm`)
    }
    const service = new RecorderService(videoService as never)

    service.configureBundleLoader(async () => '')

    return service
  }

  it('não abre outro navegador quando o pedido chega enquanto o primeiro ainda abre', async () => {
    const service = openableRecorder()

    await Promise.all([start(service), start(service)])

    expect(launch).toHaveBeenCalledTimes(1)
  })

  it('não abre outro navegador quando já existe uma gravação aberta', async () => {
    const service = openableRecorder()

    await start(service)
    await start(service)

    expect(launch).toHaveBeenCalledTimes(1)
  })

  it('abre o navegador de novo depois que a gravação é parada', async () => {
    const service = openableRecorder()

    await start(service)
    await service.stop()
    await start(service)

    expect(launch).toHaveBeenCalledTimes(2)
  })

  it('tenta abrir de novo depois que o navegador falhou ao abrir', async () => {
    const service = openableRecorder()
    launch.mockRejectedValueOnce(new Error('browserType.launch: Target page, context or browser has been closed'))

    await start(service).catch(() => undefined)
    await start(service)

    expect(launch).toHaveBeenCalledTimes(2)
  })
})
