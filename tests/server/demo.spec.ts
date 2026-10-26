// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import revoke from '../../server/api/demo.delete'
import create from '../../server/api/demo.post'
import show from '../../server/api/projects/[slug].get'
import index from '../../server/api/projects/index.get'
import runs from '../../server/api/projects/[slug]/runs.get'
import scenario from '../../server/api/projects/[slug]/scenarios/[...scenario].get'

const router = createRouter()
  .post('/api/demo', create)
  .delete('/api/demo', revoke)
  .get('/api/projects', index)
  .get('/api/projects/:slug', show)
  .get('/api/projects/:slug/runs', runs)
  .get('/api/projects/:slug/scenarios/:scenario', scenario)
const fetchApp = toWebHandler(createApp().use(router))

const DAY_MS = 24 * 60 * 60 * 1000

const DEMO_SCENARIOS = [
  'adicionar-produto-ao-carrinho',
  'finalizar-compra',
  'ordenar-produtos-por-preco'
]

interface SuiteRunBody {
  started_at: string
  passed: boolean
  tests: { id: string, passed: boolean }[]
}

let root: string
let previousRoot: string | undefined

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-demo-nitro-'))
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  process.env.ACUTIS_PROJECTS_PATH = root
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  if (previousRoot === undefined) delete process.env.ACUTIS_PROJECTS_PATH
  else process.env.ACUTIS_PROJECTS_PATH = previousRoot
})

function request(path: string, init?: RequestInit) {
  return fetchApp(new Request(`http://acutis.test${path}`, init))
}

function createDemo() {
  return request('/api/demo', { method: 'POST' })
}

function seedUserProject(slug: string, name: string) {
  const path = join(root, slug)
  mkdirSync(path, { recursive: true })
  writeFileSync(join(path, 'acutis.json'), JSON.stringify({
    name,
    slug,
    created_at: '2026-01-01T00:00:00.000Z',
    version: 1
  }))
  return path
}

async function demoRuns(): Promise<SuiteRunBody[]> {
  const response = await request('/api/projects/swag-labs/runs')
  return (await response.json() as { runs: SuiteRunBody[] }).runs
}

describe('criar o projeto de exemplo', () => {
  it('cria o Swag Labs marcado como exemplo', async () => {
    const response = await createDemo()

    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ name: 'Swag Labs', slug: 'swag-labs', demo: true })
    expect(existsSync(join(root, 'swag-labs/acutis.json'))).toBe(true)
  })

  it('não duplica o exemplo pedido outra vez', async () => {
    await createDemo()

    const response = await createDemo()
    const listing = await (await request('/api/projects')).json() as { meta: { total: number } }

    expect(response.status).toBe(200)
    expect(listing.meta.total).toBe(1)
  })

  it('marca projeto do usuário como não exemplo na listagem', async () => {
    seedUserProject('minha-loja', 'Minha Loja')

    const listing = await (await request('/api/projects')).json() as { data: { demo: boolean }[] }

    expect(listing.data).toEqual([expect.objectContaining({ demo: false })])
  })
})

describe('conteúdo do projeto de exemplo', () => {
  beforeEach(async () => {
    await createDemo()
  })

  it('aponta o ambiente para o Swag Labs', async () => {
    const detail = await (await request('/api/projects/swag-labs')).json()

    expect(detail.base_url).toBe('https://www.saucedemo.com')
  })

  it('traz o login configurado', async () => {
    const detail = await (await request('/api/projects/swag-labs')).json()

    expect(detail.auth_status).toBe('configured')
  })

  it('traz os três cenários gravados', async () => {
    const detail = await (await request('/api/projects/swag-labs')).json() as { scenarios: { title: string }[] }

    expect(detail.scenarios.map(item => item.title)).toEqual([
      'Adicionar produto ao carrinho',
      'Finalizar compra',
      'Ordenar produtos por preço'
    ])
  })

  it.each(DEMO_SCENARIOS)('traz eventos, Gherkin, Playwright e execuções em %s', async (id) => {
    const response = await request(`/api/projects/swag-labs/scenarios/${id}`)
    const detail = await response.json()

    expect(response.status).toBe(200)
    expect(detail.events.length).toBeGreaterThan(0)
    expect(detail.gherkin).toContain('Funcionalidade:')
    expect(detail.playwright).toContain('test.describe(')
    expect(detail.runs.length).toBeGreaterThan(0)
  })

  it('traz 15 rodadas no relatório', async () => {
    expect(await demoRuns()).toHaveLength(15)
  })

  it('traz rodadas verdes e vermelhas', async () => {
    const results = (await demoRuns()).map(run => run.passed)

    expect(results).toContain(true)
    expect(results).toContain(false)
  })

  it('deixa Finalizar compra instável entre as rodadas', async () => {
    const checkout = (await demoRuns())
      .flatMap(run => run.tests)
      .filter(test => test.id === 'finalizar-compra')
      .map(test => test.passed)

    expect(checkout).toContain(true)
    expect(checkout).toContain(false)
  })

  it('data a última rodada de hoje', async () => {
    const [latest] = await demoRuns()

    expect(Date.now() - Date.parse(latest!.started_at)).toBeLessThan(DAY_MS)
  })
})

describe('revogar o projeto de exemplo', () => {
  it('remove o exemplo', async () => {
    await createDemo()

    const response = await request('/api/demo', { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(existsSync(join(root, 'swag-labs'))).toBe(false)
  })

  it('mantém o projeto do usuário com o mesmo nome', async () => {
    const userProject = seedUserProject('swag-labs', 'Swag Labs')

    const response = await request('/api/demo', { method: 'DELETE' })

    expect(response.status).toBe(204)
    expect(existsSync(join(userProject, 'acutis.json'))).toBe(true)
  })
})
