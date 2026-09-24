// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const connectOverCDP = vi.fn()
const executablePath = vi.fn()

vi.mock('playwright', () => ({
  chromium: {
    launch: vi.fn(),
    connectOverCDP,
    executablePath
  }
}))

vi.mock(import('../../../config/env.js'), async importOriginal => ({
  ...await importOriginal(),
  RECORDER_CDP_URL: 'http://127.0.0.1:9222',
  RECORDER_HEADLESS: true
}))

const { RecorderService } = await import('../recorder.service.js')

function recorder() {
  return new RecorderService({ ensureDir: vi.fn().mockResolvedValue(undefined) } as never)
}

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'acutis-recorder-diagnostics-'))
  connectOverCDP.mockReset()
  executablePath.mockReset()
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('RecorderService com Chrome por CDP', () => {
  it('guarda como causa o motivo real de não ter conectado', async () => {
    const original = new Error('connect ECONNREFUSED 127.0.0.1:9222')
    connectOverCDP.mockRejectedValue(original)

    const failure = await recorder().start(() => {}, () => {}, () => {}).catch((error: unknown) => error)

    expect((failure as Error).message).toContain('Não foi possível conectar ao Chrome')
    expect((failure as Error).cause).toBe(original)
  })
})

describe('RecorderService.diagnostics', () => {
  it('conta como o navegador está configurado', () => {
    const browser = join(dir, 'chrome')
    writeFileSync(browser, '')
    executablePath.mockReturnValue(browser)

    expect(recorder().diagnostics()).toEqual({ cdp: true, headless: true, chromiumInstalled: true })
  })

  it('diz quando o Chromium do Playwright não está no disco', () => {
    executablePath.mockReturnValue(join(dir, 'nao-existe'))

    expect(recorder().diagnostics().chromiumInstalled).toBe(false)
  })

  it('não quebra quando o Playwright não sabe onde está o Chromium', () => {
    executablePath.mockImplementation(() => {
      throw new Error('sem navegador registrado')
    })

    expect(recorder().diagnostics().chromiumInstalled).toBe(false)
  })
})
