// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { captureUnhandledError } from '../../server/utils/composition/telemetry'

let root: string
const previous = { ...process.env }

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-telemetry-capture-'))
  process.env.ACUTIS_PROJECTS_PATH = root
  process.env.TELEMETRY_URL = 'https://telemetry.test/reports'
  process.env.TELEMETRY_KEY = 'chave'
  process.env.ACUTIS_TELEMETRY = '1'
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  process.env = { ...previous }
  vi.unstubAllGlobals()
})

function stubSend() {
  const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
  vi.stubGlobal('fetch', send)

  return send
}

describe('captura de erro do processo', () => {
  it('envia o erro que escapou fora de uma requisição, com mensagem, stack e origem', async () => {
    const send = stubSend()
    const error = new Error('o runner caiu sozinho')

    await captureUnhandledError(error, { tags: ['unhandledRejection'] })

    const body = JSON.parse(send.mock.lastCall![1].body)
    expect(body).toMatchObject({ message: 'o runner caiu sozinho', context: 'unhandledRejection' })
    expect(body.stack).toContain('telemetry-capture.spec')
  })

  it('deixa para a tela o erro que nasceu numa requisição', async () => {
    const send = stubSend()

    await captureUnhandledError(new Error('rota quebrou'), { event: {}, tags: ['request'] })

    expect(send).not.toHaveBeenCalled()
  })

  it('envia o que foi lançado mesmo quando não é um Error', async () => {
    const send = stubSend()

    await captureUnhandledError('texto solto', { tags: ['uncaughtException'] })

    expect(JSON.parse(send.mock.lastCall![1].body).message).toBe('texto solto')
  })

  it('não envia nada sem consentimento', async () => {
    process.env.ACUTIS_TELEMETRY = '0'
    const send = stubSend()

    await captureUnhandledError(new Error('sem consentimento no processo'), { tags: ['uncaughtException'] })

    expect(send).not.toHaveBeenCalled()
  })
})
