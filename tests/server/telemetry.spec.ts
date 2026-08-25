// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import report from '../../server/api/telemetry/report.post'

const router = createRouter().post('/api/telemetry/report', report)
const fetchApp = toWebHandler(createApp().use(router))

let root: string
const previous = { ...process.env }

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-telemetry-api-'))
  process.env.ACUTIS_PROJECTS_PATH = root
  process.env.TELEMETRY_URL = 'https://telemetry.test/reports'
  process.env.TELEMETRY_KEY = 'chave'
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  process.env = { ...previous }
  vi.unstubAllGlobals()
})

function request(body: unknown) {
  return fetchApp(new Request('http://acutis.test/api/telemetry/report', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }))
}

describe('telemetry Nitro API', () => {
  it('encaminha o relato e confirma o envio', async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', send)

    const response = await request({ message: 'boom', context: 'Gerar cenário' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: true })
    expect(send).toHaveBeenCalledOnce()
  })

  it('responde sem envio quando a api de telemetria está fora', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem rede')))

    const response = await request({ message: 'boom' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ sent: false })
  })

  it('recusa relato sem mensagem', async () => {
    const response = await request({ context: 'sem mensagem' })

    expect(response.status).toBe(422)
  })
})
