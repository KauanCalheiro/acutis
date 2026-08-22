// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import fix from '../../server/api/projects/[slug]/scenario-fix.post'
import suggestions from '../../server/api/projects/[slug]/scenario-suggestions.post'
import writeTest from '../../server/api/projects/[slug]/tests.post'
import draft from '../../server/api/projects/[slug]/tests/draft.post'
import { closeSettings } from '../../server/utils/composition/settings'

const router = createRouter()
  .post('/api/projects/:slug/scenario-fix', fix)
  .post('/api/projects/:slug/scenario-suggestions', suggestions)
  .post('/api/projects/:slug/tests', writeTest)
  .post('/api/projects/:slug/tests/draft', draft)
const fetchApp = toWebHandler(createApp().use(router))

let root: string
let project: string
let previousRoot: string | undefined

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-generation-nitro-'))
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  process.env.ACUTIS_PROJECTS_PATH = root
  project = join(root, 'minha-loja')
  mkdirSync(join(project, 'tests'), { recursive: true })
  writeFileSync(join(project, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja', slug: 'minha-loja', created_at: '2026-01-01T00:00:00.000Z', version: 1
  }))
  writeFileSync(join(project, 'tests/login.spec.ts'), 'test.describe(\'Login\', () => {})')
})

afterEach(async () => {
  await closeSettings()
  rmSync(root, { recursive: true, force: true })
  if (previousRoot === undefined) delete process.env.ACUTIS_PROJECTS_PATH
  else process.env.ACUTIS_PROJECTS_PATH = previousRoot
})

function request(path: string, body: unknown) {
  return fetchApp(new Request(`http://acutis.test${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  }))
}

describe('generation Nitro API', () => {
  it('builds an editable draft from recorder events', async () => {
    const response = await request('/api/projects/minha-loja/tests/draft', {
      baseUrl: 'https://store.test',
      events: [{
        type: 'navigate', timestamp: 1, url: 'https://store.test', selectors: null,
        label: null, value: null, inputType: null
      }]
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ tags: ['@read'], playwright: expect.stringContaining('page.goto') })
  })

  it('accepts the recording exactly as the recorder produces it, assertion and all', async () => {
    const response = await request('/api/projects/minha-loja/tests/draft', {
      baseUrl: 'https://store.test',
      events: [
        {
          type: 'navigate', timestamp: 1, url: 'https://store.test/carrinho', selectors: null,
          label: null, innerText: null, tagName: null, inputType: null, value: null,
          sensitive: false, checked: null, html: null
        },
        {
          type: 'assert', timestamp: 2, url: 'https://store.test/carrinho', selectors: null,
          label: null, innerText: null, tagName: null, inputType: null, value: null,
          sensitive: false, checked: null, html: null,
          assert: { assertType: 'url', expectedValue: 'https://store.test/carrinho' }
        }
      ]
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      playwright: expect.stringContaining('toHaveURL')
    })
  })

  it('writes reviewed test artifacts directly to the project', async () => {
    const response = await request('/api/projects/minha-loja/tests', {
      title: 'Finalizar compra', path: 'finalizar-compra', domain: 'checkout',
      gherkin: 'Funcionalidade: Compra',
      playwright: 'test.describe(\'Compra\', () => {})', tags: ['@write']
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      spec: 'tests/checkout/finalizar-compra.spec.ts',
      feature: 'features/checkout/finalizar-compra.feature',
      testRun: null
    })
    expect(readFileSync(join(project, 'tests/checkout/finalizar-compra.spec.ts'), 'utf8')).toContain('@write')
  })

  it('validates reviewed test input', async () => {
    const response = await request('/api/projects/minha-loja/tests', {
      title: '', path: '', domain: '', playwright: ''
    })

    expect(response.status).toBe(422)
    expect(await response.json()).toMatchObject({
      data: { errors: { title: expect.any(Array), path: expect.any(Array), domain: expect.any(Array) } }
    })
    expect(existsSync(join(project, 'tests/outros/teste.spec.ts'))).toBe(false)
  })

  it('serves disabled AI fallbacks without forwarding to Nest', async () => {
    const fixed = await request('/api/projects/minha-loja/scenario-fix', {
      scenarioId: 'login', step: 'abre', error: 'falhou'
    })
    const suggested = await request('/api/projects/minha-loja/scenario-suggestions', { scenarioId: 'login' })

    expect(fixed.status).toBe(200)
    expect(await fixed.json()).toEqual(expect.objectContaining({ playwright: expect.any(String), summary: expect.any(String) }))
    expect(suggested.status).toBe(200)
    expect(Array.isArray(await suggested.json())).toBe(true)
  })
})
