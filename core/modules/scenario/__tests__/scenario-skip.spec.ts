// @vitest-environment node
/** Pular e voltar a rodar um cenário: a marca vive no próprio spec, como test.describe.skip. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let dir: string

beforeEach(async () => {
  api = await startApi([])
  dir = api.projectPath('minha-loja')

  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja',
    slug: 'minha-loja',
    created_at: '2026-01-01T00:00:00+00:00',
    version: 1
  }))
})

afterEach(async () => {
  await api.close()
})

function write(relative: string, content: string): void {
  mkdirSync(join(dir, relative, '..'), { recursive: true })
  writeFileSync(join(dir, relative), content)
}

function read(relative: string): string {
  return readFileSync(join(dir, relative), 'utf8')
}

function skip(scenarioId: string, skipped: boolean) {
  return api.http.patch('/api/v1/projects/minha-loja/scenario-skip').send({ scenarioId, skipped })
}

it('marca o cenário como pulado no próprio spec', async () => {
  write('tests/login.spec.ts', 'test.describe(\'Login\', {tag: [\'@read\']}, () => {})')

  const response = await skip('login', true)

  expect(response.status).toBe(200)
  expect(response.body.skipped).toBe(true)
  expect(read('tests/login.spec.ts')).toContain('test.describe.skip(\'Login\'')
})

it('volta a rodar o cenário que estava pulado', async () => {
  write('tests/login.spec.ts', 'test.describe.skip(\'Login\', () => {})')

  const response = await skip('login', false)

  expect(response.status).toBe(200)
  expect(response.body.skipped).toBe(false)
  expect(read('tests/login.spec.ts')).toContain('test.describe(\'Login\'')
  expect(read('tests/login.spec.ts')).not.toContain('describe.skip')
})

it('não duplica a marca quando o cenário já está pulado', async () => {
  write('tests/login.spec.ts', 'test.describe.skip(\'Login\', () => {})')

  await skip('login', true)

  expect(read('tests/login.spec.ts')).toContain('test.describe.skip(\'Login\'')
  expect(read('tests/login.spec.ts')).not.toContain('skip.skip')
})

it('conta o cenário pulado na listagem do projeto', async () => {
  write('tests/login.spec.ts', 'test.describe.skip(\'Login\', () => {})')
  write('tests/checkout.spec.ts', 'test.describe(\'Checkout\', () => {})')

  const response = await api.http.get('/api/v1/projects/minha-loja')

  expect(response.status).toBe(200)
  const scenarios = response.body.scenarios as { spec: string, skipped: boolean }[]
  expect(scenarios.find(scenario => scenario.spec === 'tests/login.spec.ts')!.skipped).toBe(true)
  expect(scenarios.find(scenario => scenario.spec === 'tests/checkout.spec.ts')!.skipped).toBe(false)
})

it('recusa pular um cenário que não existe', async () => {
  const response = await skip('inexistente', true)

  expect(response.status).toBe(404)
})

it('mantém o cenário pulado depois de editar título e tags pela tela', async () => {
  write('tests/login.spec.ts', 'test.describe.skip(\'Login\', () => {})')

  const current = await api.http.get('/api/v1/projects/minha-loja/scenarios/login')
  const response = await api.http.patch('/api/v1/projects/minha-loja/scenarios/login').send({
    revision: current.body.revision,
    title: 'Login do cliente',
    path: 'login',
    domain: '',
    playwright: 'test.describe.skip(\'Login\', () => {})',
    tags: ['@read']
  })

  expect(response.status).toBe(200)
  expect(response.body.skipped).toBe(true)
  expect(response.body.title).toBe('Login do cliente')
  expect(read('tests/login.spec.ts')).toContain('test.describe.skip(\'Login do cliente\'')
  expect(read('tests/login.spec.ts')).toContain('@read')
})
