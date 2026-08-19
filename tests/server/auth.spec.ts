// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import show from '../../server/api/projects/[slug]/auth.get'
import update from '../../server/api/projects/[slug]/auth.put'
import skip from '../../server/api/projects/[slug]/auth/skip.post'

const router = createRouter()
  .get('/api/projects/:slug/auth', show)
  .put('/api/projects/:slug/auth', update)
  .post('/api/projects/:slug/auth/skip', skip)
const fetchApp = toWebHandler(createApp().use(router))

let root: string
let project: string
let previousRoot: string | undefined

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-auth-nitro-'))
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  process.env.ACUTIS_PROJECTS_PATH = root
  project = join(root, 'minha-loja')
  mkdirSync(join(project, 'tests'), { recursive: true })
  writeFileSync(join(project, 'acutis.json'), `${JSON.stringify({
    name: 'Minha Loja', slug: 'minha-loja', created_at: '2026-01-01T00:00:00.000Z', version: 1
  })}\n`)
  writeFileSync(join(project, 'tests/auth.setup.ts'), 'conteudo original')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (previousRoot === undefined) delete process.env.ACUTIS_PROJECTS_PATH
  else process.env.ACUTIS_PROJECTS_PATH = previousRoot
})

function request(path: string, init?: RequestInit) {
  return fetchApp(new Request(`http://acutis.test${path}`, init))
}

describe('auth Nitro API', () => {
  it('shows and updates the authentication setup directly', async () => {
    const shown = await request('/api/projects/minha-loja/auth')
    expect(shown.status).toBe(200)
    expect(await shown.json()).toEqual({ authSetup: 'conteudo original' })

    const updated = await request('/api/projects/minha-loja/auth', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ authSetup: 'conteudo editado' })
    })
    expect(updated.status).toBe(200)
    expect(await updated.json()).toEqual({ authSetup: 'conteudo editado' })
    expect(readFileSync(join(project, 'tests/auth.setup.ts'), 'utf8')).toBe('conteudo editado')
  })

  it('validates an empty setup before touching disk', async () => {
    const response = await request('/api/projects/minha-loja/auth', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ authSetup: '' })
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({ data: { errors: { authSetup: expect.any(Array) } } })
    expect(readFileSync(join(project, 'tests/auth.setup.ts'), 'utf8')).toBe('conteudo original')
  })

  it('marks authentication as skipped', async () => {
    const response = await request('/api/projects/minha-loja/auth/skip', { method: 'POST' })

    expect(response.status).toBe(204)
    expect(JSON.parse(readFileSync(join(project, 'acutis.json'), 'utf8'))).toMatchObject({ auth_skipped: true })
  })

  it('returns 404 for an unknown project', async () => {
    const response = await request('/api/projects/inexistente/auth')
    expect(response.status).toBe(404)
  })
})
