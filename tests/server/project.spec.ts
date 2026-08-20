// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import destroy from '../../server/api/projects/[slug].delete'
import show from '../../server/api/projects/[slug].get'
import update from '../../server/api/projects/[slug].put'
import credentials from '../../server/api/projects/[slug]/auth/credentials.post'
import settings from '../../server/api/projects/[slug]/settings.put'
import skipSettings from '../../server/api/projects/[slug]/settings/skip.post'
import index from '../../server/api/projects/index.get'
import store from '../../server/api/projects/index.post'
import probe from '../../server/api/projects/probe.post'

const router = createRouter()
  .get('/api/projects', index)
  .post('/api/projects', store)
  .post('/api/projects/probe', probe)
  .get('/api/projects/:slug', show)
  .put('/api/projects/:slug', update)
  .delete('/api/projects/:slug', destroy)
  .put('/api/projects/:slug/settings', settings)
  .post('/api/projects/:slug/settings/skip', skipSettings)
  .post('/api/projects/:slug/auth/credentials', credentials)
const fetchApp = toWebHandler(createApp().use(router))

let root: string
let previousRoot: string | undefined

function seed(slug: string, name: string) {
  const path = join(root, slug)
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, 'acutis.json'), `${JSON.stringify({
    name,
    slug,
    created_at: '2026-01-01T00:00:00.000Z',
    version: 1
  })}\n`)
  return path
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-project-nitro-'))
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  process.env.ACUTIS_PROJECTS_PATH = root
  seed('alpha-store', 'Alpha Store')
  seed('beta-store', 'Beta Store')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (previousRoot === undefined) delete process.env.ACUTIS_PROJECTS_PATH
  else process.env.ACUTIS_PROJECTS_PATH = previousRoot
})

function request(path: string, init?: RequestInit) {
  return fetchApp(new Request(`http://acutis.test${path}`, init))
}

function json(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }
}

describe('project Nitro API', () => {
  it('lists, filters and paginates projects without calling Nest', async () => {
    const response = await request('/api/projects?filter[name]=beta&page[size]=1&page[number]=1')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      data: [{ slug: 'beta-store' }],
      meta: { current_page: 1, per_page: 1, total: 1 }
    })
  })

  it('shows the complete project', async () => {
    const response = await request('/api/projects/alpha-store')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      name: 'Alpha Store',
      slug: 'alpha-store',
      scenarios: [],
      auth_status: 'unset'
    })
  })

  it('creates a project from the bundled template', async () => {
    const response = await request('/api/projects', json('POST', { name: 'Minha Loja' }))

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ name: 'Minha Loja', slug: 'minha-loja' })
    expect(existsSync(join(root, 'minha-loja/acutis.json'))).toBe(true)
  })

  it('validates project creation input', async () => {
    const response = await request('/api/projects', json('POST', { name: '' }))

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      data: { errors: { name: ['O nome é obrigatório.'] } }
    })
  })

  it('updates and moves the project directory', async () => {
    const response = await request('/api/projects/alpha-store', json('PUT', { name: 'Loja Principal' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ name: 'Loja Principal', slug: 'loja-principal' })
    expect(existsSync(join(root, 'loja-principal/acutis.json'))).toBe(true)
  })

  it('stores URL and credentials in the project environment', async () => {
    const settingsResponse = await request('/api/projects/alpha-store/settings', json('PUT', {
      baseUrl: 'https://store.test'
    }))
    const credentialsResponse = await request('/api/projects/alpha-store/auth/credentials', json('POST', {
      username: 'ana',
      password: 'secret'
    }))

    expect(settingsResponse.status).toBe(200)
    expect(await settingsResponse.json()).toEqual({ base_url: 'https://store.test' })
    expect(credentialsResponse.status).toBe(204)
    expect(JSON.parse(readFileSync(join(root, 'alpha-store/environments/ambiente.json'), 'utf8')))
      .toMatchObject({
        vars: expect.arrayContaining([
          { key: 'AUTH_USER', value: 'ana', secret: false },
          { key: 'AUTH_PASSWORD', value: 'secret', secret: true }
        ])
      })
  })

  it('marks URL setup as skipped', async () => {
    const response = await request('/api/projects/alpha-store/settings/skip', { method: 'POST' })

    expect(response.status).toBe(204)
    expect(JSON.parse(readFileSync(join(root, 'alpha-store/acutis.json'), 'utf8'))).toMatchObject({
      url_skipped: true
    })
  })

  it('removes the complete project', async () => {
    const response = await request('/api/projects/alpha-store', { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(existsSync(join(root, 'alpha-store'))).toBe(false)
  })

  it('probes an inaccessible repository without forwarding to Nest', async () => {
    const response = await request('/api/projects/probe', json('POST', { url: join(root, 'missing.git') }))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ public: false })
  })
})
