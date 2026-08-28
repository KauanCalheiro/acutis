// @vitest-environment node
/** Toda ação que escreve no projeto versiona o que escreveu: o repositório nunca fica atrás da tela. */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
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

  execFileSync('git', ['init', '-q', '-b', 'trunk', dir])
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'testadora@acutis.dev'])
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Testadora'])
  execFileSync('git', ['-C', dir, 'add', '.'])
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'init'])
})

afterEach(async () => {
  await api.close()
})

function write(relative: string, content: string): void {
  mkdirSync(join(dir, relative, '..'), { recursive: true })
  writeFileSync(join(dir, relative), content)
}

function commit(relative: string, content: string): void {
  write(relative, content)
  execFileSync('git', ['-C', dir, 'add', '.'])
  execFileSync('git', ['-C', dir, 'commit', '-qm', `fixture ${relative}`])
}

function pending(): string {
  return execFileSync('git', ['-C', dir, 'status', '--porcelain'], { encoding: 'utf8' }).trim()
}

function lastCommit(): string {
  return execFileSync('git', ['-C', dir, 'log', '-1', '--name-only', '--pretty=format:%s'], { encoding: 'utf8' })
}

it('versiona a exclusão de um cenário', async () => {
  commit('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')
  commit('features/login.feature', 'Funcionalidade: Login')

  const response = await api.http.delete('/api/v1/projects/minha-loja/scenarios/login')

  expect(response.status).toBe(204)
  expect(pending()).toBe('')
  expect(lastCommit()).toContain('test: remover cenário login')
  expect(lastCommit()).toContain('tests/login.spec.ts')
  expect(lastCommit()).toContain('features/login.feature')
})

it('versiona a edição de um cenário, com o arquivo que saiu e o que entrou', async () => {
  commit('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')
  commit('features/login.feature', 'Funcionalidade: Login')

  const current = await api.http.get('/api/v1/projects/minha-loja/scenarios/login')
  const response = await api.http.patch('/api/v1/projects/minha-loja/scenarios/login').send({
    revision: current.body.revision,
    title: 'Entrar no sistema',
    path: 'entrar',
    domain: 'auth',
    gherkin: 'Funcionalidade: Entrar\n  Cenário: entra',
    playwright: 'test.describe(\'Entrar\', () => {})',
    tags: ['@read']
  })

  expect(response.status).toBe(200)
  expect(pending()).toBe('')
  expect(lastCommit()).toContain('test: atualizar cenário auth/entrar')
  expect(lastCommit()).toContain('tests/auth/entrar.spec.ts')
  expect(lastCommit()).toContain('tests/login.spec.ts')
})

it('versiona o cenário que foi pulado', async () => {
  commit('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')

  const response = await api.http.patch('/api/v1/projects/minha-loja/scenario-skip')
    .send({ scenarioId: 'login', skipped: true })

  expect(response.status).toBe(200)
  expect(pending()).toBe('')
  expect(lastCommit()).toContain('test: pular cenário login')
})

it('versiona o cenário que voltou a rodar', async () => {
  commit('tests/login.spec.ts', 'test.describe.skip(\'Login\', () => {})')

  await api.http.patch('/api/v1/projects/minha-loja/scenario-skip')
    .send({ scenarioId: 'login', skipped: false })

  expect(pending()).toBe('')
  expect(lastCommit()).toContain('test: voltar a rodar cenário login')
})

it('não commita quando pular não mudou nada no arquivo', async () => {
  commit('tests/login.spec.ts', 'test.describe.skip(\'Login\', () => {})')
  const before = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' })

  await api.http.patch('/api/v1/projects/minha-loja/scenario-skip')
    .send({ scenarioId: 'login', skipped: true })

  expect(execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' })).toBe(before)
})

it('versiona o cenário que a geração acabou de escrever', async () => {
  const response = await api.http.post('/api/v1/projects/minha-loja/tests').send({
    title: 'Checkout do carrinho',
    tags: ['@write'],
    domain: 'checkout',
    path: 'checkout-do-carrinho',
    gherkin: 'Funcionalidade: Checkout\n  Cenário: paga',
    playwright: 'test.describe(\'Checkout\', () => {})'
  })

  expect(response.status).toBe(200)
  expect(pending()).toBe('')
  expect(lastCommit()).toContain('test: adicionar cenário checkout/checkout-do-carrinho')
  expect(lastCommit()).toContain('tests/checkout/checkout-do-carrinho.spec.ts')
  expect(lastCommit()).toContain('features/checkout/checkout-do-carrinho.feature')
})

it('versiona a configuração do projeto que a tela salvou', async () => {
  const response = await api.http.put('/api/v1/projects/minha-loja/settings').send({ baseUrl: 'https://loja.test' })

  expect(response.status).toBe(200)
  expect(pending()).toBe('')
  expect(lastCommit()).toContain('chore: atualizar configurações do projeto')
  expect(lastCommit()).toContain('.gitignore')
  expect(lastCommit()).toContain('.env.example')
})

it('versiona a autenticação salva pelo editor', async () => {
  commit('tests/auth.setup.ts', 'setup(\'login\', async () => {})')

  const response = await api.http.put('/api/v1/projects/minha-loja/auth')
    .send({ authSetup: 'setup(\'login\', async () => { /* revisado */ })' })

  expect(response.status).toBe(200)
  expect(pending()).toBe('')
  expect(lastCommit()).toContain('test: atualizar a autenticação')
  expect(lastCommit()).toContain('tests/auth.setup.ts')
})

it('deixa o projeto sem git em paz', async () => {
  execFileSync('rm', ['-rf', join(dir, '.git')])
  write('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')

  const response = await api.http.patch('/api/v1/projects/minha-loja/scenario-skip')
    .send({ scenarioId: 'login', skipped: true })

  expect(response.status).toBe(200)
  expect(response.body.skipped).toBe(true)
})
