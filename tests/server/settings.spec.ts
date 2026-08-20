// @vitest-environment node
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import show from '../../server/api/settings/ai.get'
import update from '../../server/api/settings/ai.put'
import { closeSettings } from '../../server/utils/composition/settings'

const router = createRouter()
  .get('/api/settings/ai', show)
  .put('/api/settings/ai', update)
const fetchApp = toWebHandler(createApp().use(router))

let root: string
let previousRoot: string | undefined

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-settings-nitro-'))
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  process.env.ACUTIS_PROJECTS_PATH = root
})

afterEach(async () => {
  await closeSettings()
  rmSync(root, { recursive: true, force: true })
  if (previousRoot === undefined) delete process.env.ACUTIS_PROJECTS_PATH
  else process.env.ACUTIS_PROJECTS_PATH = previousRoot
})

function request(path: string, init?: RequestInit) {
  return fetchApp(new Request(`http://acutis.test${path}`, init))
}

describe('settings Nitro API', () => {
  it('migrates a fresh database and exposes every provider', async () => {
    const response = await request('/api/settings/ai')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      provider: 'gemini',
      configured: true,
      providers: expect.arrayContaining(['ollama', 'openai'])
    })
    expect(existsSync(join(root, 'runtime/database.sqlite'))).toBe(true)
  })

  it('persists the selected provider and its credentials', async () => {
    const response = await request('/api/settings/ai', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'ollama', url: 'http://localhost:11434', model: 'llama3.1:8b' })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      provider: 'ollama',
      configured: true,
      credentials: {
        ollama: { url: 'http://localhost:11434', model: 'llama3.1:8b' }
      }
    })

    const persisted = await request('/api/settings/ai')
    expect(await persisted.json()).toMatchObject({ provider: 'ollama', configured: true })
  })

  it('validates the update body in Nitro', async () => {
    const response = await request('/api/settings/ai', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ data: { errors: { provider: expect.any(Array) } } })
  })

  it('turns AI off when the form sends a null provider', async () => {
    const response = await request('/api/settings/ai', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: null, key: null, url: null, model: null })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ provider: '', configured: false })
  })

  it('keeps the model validation message used by the form', async () => {
    const response = await request('/api/settings/ai', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ provider: 'openrouter', key: 'sk-test', model: null })
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      data: { errors: { model: ['Escolha um modelo do provedor.'] } }
    })
  })
})
