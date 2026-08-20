// @vitest-environment node
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, expect, it } from 'vitest'
import activate from '../../server/api/projects/[slug]/environments/[environment]/activate.post'
import destroy from '../../server/api/projects/[slug]/environments/[environment].delete'
import update from '../../server/api/projects/[slug]/environments/[environment].put'
import index from '../../server/api/projects/[slug]/environments/index.get'
import store from '../../server/api/projects/[slug]/environments/index.post'

const SLUG = 'minha-loja'
const BASE = `/api/projects/${SLUG}/environments`

let root: string
let project: string
let previousRoot: string | undefined

const router = createRouter()
  .get('/api/projects/:slug/environments', index)
  .post('/api/projects/:slug/environments', store)
  .put('/api/projects/:slug/environments/:environment', update)
  .delete('/api/projects/:slug/environments/:environment', destroy)
  .post('/api/projects/:slug/environments/:environment/activate', activate)
const fetchApp = toWebHandler(createApp().use(router))

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-nitro-test-'))
  project = join(root, SLUG)
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  process.env.ACUTIS_PROJECTS_PATH = root

  mkdirSync(project, { recursive: true })
  writeFileSync(join(project, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja',
    slug: SLUG,
    created_at: '2026-01-01T00:00:00+00:00',
    version: 1
  }))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })

  if (previousRoot === undefined) {
    delete process.env.ACUTIS_PROJECTS_PATH
  } else {
    process.env.ACUTIS_PROJECTS_PATH = previousRoot
  }
})

function request(path: string, init?: RequestInit): Promise<Response> {
  return fetchApp(new Request(`http://acutis.test${path}`, init))
}

function stored(slug: string): { name: string } {
  return JSON.parse(readFileSync(join(project, `environments/${slug}.json`), 'utf8'))
}

it('lista os ambientes diretamente pelo Nitro', async () => {
  const response = await request(BASE)

  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    active: 'ambiente',
    environments: [{ slug: 'ambiente', name: 'Ambiente' }]
  })
})

it('cria um ambiente diretamente pelo Nitro', async () => {
  const response = await request(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Homologação' })
  })

  expect(response.status).toBe(201)
  expect(await response.json()).toMatchObject({ slug: 'homologacao', name: 'Homologação' })
  expect(stored('homologacao').name).toBe('Homologação')
})

it('valida a entrada do ambiente no Nitro', async () => {
  const response = await request(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: '' })
  })

  expect(response.status).toBe(422)
  expect(await response.json()).toMatchObject({
    data: {
      message: 'Os dados informados são inválidos.',
      errors: { name: ['O nome do ambiente é obrigatório.'] }
    }
  })
})

it('atualiza um ambiente diretamente pelo Nitro', async () => {
  await request(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Homologação' })
  })

  const response = await request(`${BASE}/homologacao`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'Homologação',
      vars: [{ key: 'URL', value: 'https://homologacao.test' }]
    })
  })

  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({
    vars: [{ key: 'URL', value: 'https://homologacao.test' }]
  })
})

it('ativa um ambiente diretamente pelo Nitro', async () => {
  await request(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Homologação' })
  })

  const response = await request(`${BASE}/homologacao/activate`, { method: 'POST' })

  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ slug: 'homologacao' })
  expect(readFileSync(join(project, '.env'), 'utf8')).toContain('ENVIRONMENT=homologacao')
})

it('remove um ambiente diretamente pelo Nitro', async () => {
  await request(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Homologação' })
  })

  const response = await request(`${BASE}/homologacao`, { method: 'DELETE' })

  expect(response.status).toBe(204)
})

it('traduz erro de domínio no Nitro', async () => {
  const response = await request('/api/projects/desconhecido/environments')

  expect(response.status).toBe(404)
  expect(await response.json()).toMatchObject({
    data: { message: 'Projeto não encontrado.' }
  })
})
