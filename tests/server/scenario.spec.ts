// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import destroy from '../../server/api/projects/[slug]/scenarios/[...scenario].delete'
import show from '../../server/api/projects/[slug]/scenarios/[...scenario].get'
import update from '../../server/api/projects/[slug]/scenarios/[...scenario].patch'

const router = createRouter()
  .get('/api/projects/:slug/scenarios/:scenario', show)
  .patch('/api/projects/:slug/scenarios/:scenario', update)
  .delete('/api/projects/:slug/scenarios/:scenario', destroy)
const fetchApp = toWebHandler(createApp().use(router))

let root: string
let project: string
let previousRoot: string | undefined

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-scenario-nitro-'))
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  process.env.ACUTIS_PROJECTS_PATH = root
  project = join(root, 'minha-loja')
  mkdirSync(join(project, 'tests'), { recursive: true })
  mkdirSync(join(project, 'features'), { recursive: true })
  writeFileSync(join(project, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja', slug: 'minha-loja', created_at: '2026-01-01T00:00:00.000Z', version: 1
  }))
  writeFileSync(join(project, 'tests/login.spec.ts'), 'test.describe(\'Login\', { tag: [\'@read\'] }, () => {})')
  writeFileSync(join(project, 'features/login.feature'), 'Funcionalidade: Login')
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (previousRoot === undefined) delete process.env.ACUTIS_PROJECTS_PATH
  else process.env.ACUTIS_PROJECTS_PATH = previousRoot
})

function request(path: string, init?: RequestInit) {
  return fetchApp(new Request(`http://acutis.test${path}`, init))
}

describe('scenario Nitro API', () => {
  it('shows a scenario directly from disk', async () => {
    const response = await request('/api/projects/minha-loja/scenarios/login')

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      title: 'Login', spec: 'tests/login.spec.ts', gherkin: 'Funcionalidade: Login', tags: ['@read']
    })
  })

  it('updates and moves scenario artifacts', async () => {
    const response = await request('/api/projects/minha-loja/scenarios/login', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: 'Login atualizado', path: 'entrar', domain: 'auth',
        gherkin: 'Funcionalidade: Login\n  Cenário: entra',
        playwright: 'test.describe(\'Login\', () => {})', tags: ['@smoke']
      })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ title: 'Login atualizado', spec: 'tests/auth/entrar.spec.ts' })
    expect(existsSync(join(project, 'tests/login.spec.ts'))).toBe(false)
    expect(readFileSync(join(project, 'tests/auth/entrar.spec.ts'), 'utf8')).toContain('@smoke')
  })

  it('validates the editable fields', async () => {
    const response = await request('/api/projects/minha-loja/scenarios/login', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '', path: '', playwright: '' })
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      data: { errors: { title: expect.any(Array), path: expect.any(Array), playwright: expect.any(Array) } }
    })
  })

  it('removes spec and feature', async () => {
    const response = await request('/api/projects/minha-loja/scenarios/login', { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(existsSync(join(project, 'tests/login.spec.ts'))).toBe(false)
    expect(existsSync(join(project, 'features/login.feature'))).toBe(false)
  })
})
