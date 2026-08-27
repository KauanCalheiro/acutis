// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, defineEventHandler, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { sendVideoFile } from '../../server/utils/video-file'

let directory: string
let video: string

const router = createRouter().get('/video', defineEventHandler(event => sendVideoFile(event, video)))
const fetchApp = toWebHandler(createApp().use(router))

function get(headers: Record<string, string> = {}) {
  return fetchApp(new Request('http://localhost/video', { headers }))
}

beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'acutis-video-'))
  video = join(directory, 'sessao.webm')
  writeFileSync(video, 'webm-de-mentira')
})

afterEach(() => {
  rmSync(directory, { recursive: true, force: true })
})

describe('sendVideoFile', () => {
  it('anuncia que aceita pedaços, para o player conseguir pular no tempo', async () => {
    const response = await get()

    expect(response.status).toBe(200)
    expect(response.headers.get('accept-ranges')).toBe('bytes')
    expect(response.headers.get('content-length')).toBe('15')
    expect(response.headers.get('content-type')).toBe('video/webm')
    expect(await response.text()).toBe('webm-de-mentira')
  })

  it('devolve só o pedaço pedido', async () => {
    const response = await get({ range: 'bytes=0-3' })

    expect(response.status).toBe(206)
    expect(response.headers.get('content-range')).toBe('bytes 0-3/15')
    expect(await response.text()).toBe('webm')
  })

  it('recusa o intervalo que começa depois do fim do arquivo', async () => {
    const response = await get({ range: 'bytes=99-' })

    expect(response.status).toBe(416)
    expect(response.headers.get('content-range')).toBe('bytes */15')
  })
})
