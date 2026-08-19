// @vitest-environment node
/** A edição de um cenário pela tela: renomear, mover de domínio, retagear e apagar o Gherkin. */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    title: 'Login atualizado',
    path: 'login',
    domain: '',
    gherkin: 'Funcionalidade: Login\n  Cenário: entra',
    playwright: 'test.describe(\'Login\', () => {})',
    tags: ['@read'],
    ...overrides
  }
}

function update(id: string, body: Record<string, unknown>) {
  return api.http.patch(`/api/v1/projects/minha-loja/scenarios/${id}`).send(body)
}

it('atualiza o cenário no lugar quando domínio e caminho não mudam', async () => {
  write('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')
  write('features/login.feature', 'Funcionalidade: Login')

  const response = await update('login', payload())

  expect(response.status).toBe(200)
  expect(response.body.spec).toBe('tests/login.spec.ts')
  expect(response.body.title).toBe('Login atualizado')
  expect(response.body.tags).toEqual(['@read'])

  expect(read('features/login.feature')).toContain('Funcionalidade: Login atualizado')
  expect(read('tests/login.spec.ts')).toContain('@read')
})

it('renomeia os arquivos do cenário e leva a gravação junto', async () => {
  write('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')
  write('features/login.feature', 'Funcionalidade: Login')
  write('tests/login.events.json', '[{"type":"click"}]')

  const response = await update('login', payload({ path: 'entrar', domain: 'auth' }))

  expect(response.status).toBe(200)
  expect(response.body.spec).toBe('tests/auth/entrar.spec.ts')
  expect(response.body.domain).toBe('auth')

  expect(existsSync(join(dir, 'tests/login.spec.ts'))).toBe(false)
  expect(existsSync(join(dir, 'features/login.feature'))).toBe(false)
  expect(existsSync(join(dir, 'tests/login.events.json'))).toBe(false)

  expect(existsSync(join(dir, 'tests/auth/entrar.spec.ts'))).toBe(true)
  expect(existsSync(join(dir, 'features/auth/entrar.feature'))).toBe(true)
  expect(read('tests/auth/entrar.events.json')).toBe('[{"type":"click"}]')
})

it('recusa um título ou um caminho maior do que cabe num nome de arquivo', async () => {
  write('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')

  const response = await update('login', payload({
    title: 'cenário '.repeat(40),
    path: 'caminho-'.repeat(20)
  }))

  expect(response.status).toBe(422)
  expect(response.body.errors.title).toBeDefined()
  expect(response.body.errors.path).toBeDefined()
})

it('recusa renomear para um cenário que já existe', async () => {
  write('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')
  write('tests/cadastro.spec.ts', 'test.describe(\'Cadastro\', () => {})')

  const response = await update('login', payload({ path: 'cadastro' }))

  expect(response.status).toBe(422)
  expect(response.body.errors.path).toBeDefined()

  expect(existsSync(join(dir, 'tests/login.spec.ts'))).toBe(true)
})

it('edita o setup de autenticação sem nunca mover os arquivos dele', async () => {
  write('tests/auth.setup.ts', 'setup(\'entrar\', async () => {})')
  write('features/auth.feature', 'Funcionalidade: Entrar')

  const response = await update('auth', payload({
    title: 'Entrar na plataforma',
    path: 'entrar-na-plataforma',
    domain: 'acesso',
    playwright: 'setup(\'entrar\', async () => { await page.goto(\'/\') })',
    tags: []
  }))

  expect(response.status).toBe(200)
  expect(response.body.spec).toBe('tests/auth.setup.ts')
  expect(response.body.feature).toBe('features/auth.feature')
  expect(response.body.is_auth).toBe(true)
  expect(response.body.title).toBe('Entrar na plataforma')

  expect(existsSync(join(dir, 'tests/auth.setup.ts'))).toBe(true)
  expect(existsSync(join(dir, 'tests/acesso/entrar-na-plataforma.spec.ts'))).toBe(false)
  expect(read('tests/auth.setup.ts')).toContain('await page.goto(\'/\')')
  expect(read('features/auth.feature')).toContain('Funcionalidade: Entrar na plataforma')
})

it('escreve a feature de autenticação na primeira edição de um setup sem ela', async () => {
  write('tests/auth.setup.ts', 'setup(\'entrar\', async () => {})')

  const response = await update('auth', payload({ title: 'Entrar', tags: [] }))

  expect(response.status).toBe(200)
  expect(response.body.feature).toBe('features/auth.feature')

  expect(read('features/auth.feature')).toContain('Funcionalidade: Entrar')
})

/** Sem .feature o título é lido do describe do spec, então é lá que a edição precisa gravá-lo. */
it('renomeia o título dentro do spec de um cenário sem feature', async () => {
  write('tests/login.spec.ts', 'test.describe(\'Login\', { tag: [\'@read\'] }, () => {})')

  const response = await update('login', payload({ gherkin: '', title: 'Entrar no sistema' }))

  expect(response.status).toBe(200)
  expect(response.body.title).toBe('Entrar no sistema')

  expect(read('tests/login.spec.ts')).toContain('test.describe(\'Entrar no sistema\'')
})

/** Apagar o campo na tela é ordem de apagar o arquivo: senão a aba voltaria com o texto antigo. */
it('apaga o arquivo de feature quando o campo do gherkin volta vazio', async () => {
  write('tests/login.spec.ts', 'test.describe(\'Login\', () => {})')
  write('features/login.feature', 'Funcionalidade: Login')

  const response = await update('login', payload({ gherkin: '' }))

  expect(response.status).toBe(200)
  expect(response.body.gherkin).toBeNull()
  expect(response.body.feature).toBeNull()

  expect(existsSync(join(dir, 'features/login.feature'))).toBe(false)
})

it('devolve 404 para um cenário desconhecido', async () => {
  mkdirSync(join(dir, 'tests'), { recursive: true })

  expect((await update('nao-existe', payload())).status).toBe(404)
})

it('devolve 404 para um projeto desconhecido', async () => {
  const response = await api.http
    .patch('/api/v1/projects/nao-existe/scenarios/login')
    .send(payload())

  expect(response.status).toBe(404)
})
