// @vitest-environment node
/** O login gravado virando `tests/auth.setup.ts`. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from 'vitest'
import { writeGherkin } from '../../ai/agents/gherkin.js'
import { fixSpec } from '../../ai/agents/spec-fixer.js'
import { RunnerService, type RunResult } from '../../../webdriver/runner/runner.service.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { EnvKey } from '../../environment/providers/env-key.js'

/** O setup que o corretor devolve, reconhecível pelos seletores que só ele usa. */
const { CORRECTED } = vi.hoisted(() => ({
  CORRECTED: [
    'import { test as setup, expect } from \'@playwright/test\'',
    '',
    'const base = process.env.URL',
    '',
    'setup(\'autenticação\', async ({ page }) => {',
    '    await page.goto(base)',
    '    await page.getByTestId(\'login-usuario\').fill(process.env.AUTH_USER)',
    '    await page.getByTestId(\'login-senha\').fill(process.env.AUTH_PASSWORD)',
    '    await expect(page.getByTestId(\'login-senha\')).toBeHidden()',
    '    await page.context().storageState({ path: process.env.STORAGE_STATE || \'storage-state.json\' })',
    '})',
    ''
  ].join('\n')
}))

/** O dublê do agente que escreve o Gherkin do login. */
vi.mock('../../ai/agents/gherkin.js', () => ({
  writeGherkin: vi.fn(async () => ({
    gherkin: 'Funcionalidade: Entrar no sistema\n  Cenário: informa as credenciais',
    domain: 'acesso'
  }))
}))

/** O dublê do agente que conserta o setup que quebrou. */
vi.mock('../../ai/agents/spec-fixer.js', () => ({
  fixSpec: vi.fn(async () => ({ playwright: CORRECTED, summary: 'trocou o seletor do campo de senha' }))
}))

let api: Harness
let dir: string
let runner: MockInstance<RunnerService['run']>

const SLUG = 'portal-sistema'

beforeEach(async () => {
  vi.clearAllMocks()

  api = await startApi([])

  runner = vi.spyOn(RunnerService.prototype, 'run')
  runsReturning({ passed: true, output: 'ok' })
})

afterEach(async () => {
  vi.restoreAllMocks()
  await api.close()
})

/** Os resultados que a execução devolve, na ordem; o último se repete. */
function runsReturning(...results: RunResult[]): void {
  runner.mockImplementation(async () => results[Math.min(runner.mock.calls.length - 1, results.length - 1)]!)
}

/** O ambiente do que foi mandado executar. */
function runEnv(call = 0): Record<string, string> {
  return (runner.mock.calls[call]?.[1]?.env ?? {}) as Record<string, string>
}

/** Cadastra um provedor de IA, que é o que liga os agentes; sem isto o projeto roda sem modelo. */
async function configureAi(): Promise<void> {
  await api.http
    .put('/api/v1/settings/ai')
    .send({ provider: 'ollama', model: 'llama3.1:8b' })
    .expect(200)
}

async function recordProject(name = 'Portal Sistema'): Promise<void> {
  await api.http.post('/api/v1/projects/create/template').send({ name }).expect(201)

  dir = api.projectPath(SLUG)
}

function recordPayload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    baseUrl: 'https://sistema.test/login',
    events: [
      { type: 'navigate', timestamp: 1, url: 'https://sistema.test/login', selectors: null, label: null, value: null, inputType: null },
      { type: 'fill', timestamp: 2, url: 'https://sistema.test/login', selectors: { dataTestId: 'user' }, label: 'Usuário', value: 'user1', inputType: 'text' },
      { type: 'fill', timestamp: 3, url: 'https://sistema.test/login', selectors: { dataTestId: 'pass' }, label: 'Senha', value: 'topsecret123', inputType: 'password' },
      { type: 'submit', timestamp: 4, url: 'https://sistema.test/login', selectors: { dataTestId: 'entrar' }, label: 'Entrar', value: null, inputType: null }
    ],
    ...overrides
  }
}

function record(payload: Record<string, unknown> = recordPayload()) {
  return api.http.post(`/api/v1/projects/${SLUG}/auth/record`).send(payload)
}

function file(relative: string): string {
  return readFileSync(join(dir, relative), 'utf8')
}

/** O `.env` do projeto, que nasce inexistente, então lê-lo direto quebraria antes da asserção. */
function dotenv(): string {
  return existsSync(join(dir, '.env')) ? file('.env') : ''
}

function environmentVars(): { key: string, value: string, secret: boolean }[] {
  return JSON.parse(file('environments/ambiente.json')).vars
}

it('escreve no projeto o setup gerado a partir da gravação', async () => {
  await recordProject()

  const response = await record()

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain('setup(\'autenticação\'')
  expect(response.body.credentialsNeeded).toBe(false)

  expect(file('tests/auth.setup.ts')).toContain('import { test as setup, expect } from \'@playwright/test\'')
  expect(existsSync(join(dir, '.gitignore'))).toBe(true)
})

it('nunca define a url base, que vem só das configurações do projeto', async () => {
  await recordProject()

  const config = file('playwright.config.ts')

  await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' })).expect(200)

  expect(dotenv()).not.toContain('URL')
  expect(file('playwright.config.ts')).toBe(config)
})

it('baseia o setup na url do projeto, não no host para onde a gravação foi redirecionada', async () => {
  await recordProject()

  await api.http
    .put(`/api/v1/projects/${SLUG}/settings`)
    .send({ baseUrl: 'https://sistema.test/intranet' })
    .expect(200)

  const response = await record(recordPayload({ baseUrl: 'https://sso.sistema.test' }))

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain('await page.goto(`${base}')
  expect(response.body.authSetup).not.toContain('sso.sistema.test')
})

it('nunca executa nada quando a gravação não diz onde rodar', async () => {
  await recordProject()

  await record().expect(200)

  expect(runner).not.toHaveBeenCalled()
})

it('roda o setup antes de responder quando a gravação diz onde rodar', async () => {
  await recordProject()

  await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' })).expect(200)

  expect(runner).toHaveBeenCalled()
  expect(runEnv()[EnvKey.URL]).toBe('https://homolog.sistema.test')
})

it('nomeia o arquivo de sessão da execução, para a execução devolver a sessão salva', async () => {
  await recordProject()

  await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' })).expect(200)

  expect(runEnv()[EnvKey.STORAGE_STATE]).toBe('storage-state.json')
})

it('roda o setup com as credenciais desta gravação, antes de elas chegarem ao ambiente', async () => {
  await recordProject()

  await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' })).expect(200)

  expect(runEnv()[EnvKey.USER]).toBe('user1')
  expect(runEnv()[EnvKey.PASSWORD]).toBe('topsecret123')
})

it('avisa quando a execução passou sem deixar sessão', async () => {
  await recordProject()
  runsReturning({ passed: true, output: 'ok' })

  const response = await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' }))

  expect(response.status).toBe(200)
  expect(response.body.warnings.some((warning: string) => warning.includes('sessao-nao-salva'))).toBe(true)
})

it('manda ao corretor o setup que falhou na execução, com o erro e a página quebrada', async () => {
  await recordProject()
  await configureAi()
  runsReturning(
    { passed: false, output: 'locator(\'#pass\') resolved to hidden', html: '<input data-testid="senha">' },
    { passed: true, output: 'ok' }
  )

  await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' })).expect(200)

  const [, input] = vi.mocked(fixSpec).mock.calls[0]!

  expect(input.run?.error).toContain('locator(\'#pass\') resolved to hidden')
  expect(input.html).toContain('data-testid="senha"')
})

it('conserta o login com o provedor cadastrado nas configurações', async () => {
  await recordProject()
  await configureAi()
  runsReturning(
    { passed: false, output: 'falhou', html: '<input data-testid="senha">' },
    { passed: true, output: 'ok' }
  )

  await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' })).expect(200)

  const [config] = vi.mocked(fixSpec).mock.calls[0]!

  expect(config.provider).toBe('ollama')
  expect(config.model).toBe('llama3.1:8b')
})

it('escreve o setup que o corretor devolveu, e não o que saiu da gravação', async () => {
  await recordProject()
  await configureAi()
  runsReturning(
    { passed: false, output: 'falhou', html: '<input data-testid="senha">' },
    { passed: true, output: 'ok' }
  )

  const response = await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' }))

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain('getByTestId(\'login-senha\')')
  expect(file('tests/auth.setup.ts')).toContain('getByTestId(\'login-senha\')')
})

/**
 * Sem provedor não há corretor, e o que foi gravado é tudo o que existe. Substituí-lo por um
 * arquivo qualquer entregaria ao usuário um login de outra aplicação.
 */
it('preserva o setup gravado quando não há provedor, mesmo que a execução falhe', async () => {
  await recordProject()
  runsReturning({ passed: false, output: 'falhou', html: '<input data-testid="senha">' })

  const response = await record(recordPayload({ executionUrl: 'https://homolog.sistema.test' }))

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain(`fill(process.env.${EnvKey.USER})`)
  expect(response.body.authSetup).not.toContain('getByTestId(\'login-senha\')')
  expect(vi.mocked(fixSpec)).not.toHaveBeenCalled()
})

it('lê as credenciais das chaves do ambiente, sem nunca escrever a senha gravada', async () => {
  await recordProject()

  const response = await record()

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain(`fill(process.env.${EnvKey.USER})`)
  expect(response.body.authSetup).toContain(`fill(process.env.${EnvKey.PASSWORD})`)
  expect(response.body.authSetup).not.toContain('topsecret123')
})

it('confirma o login pela url em que a gravação parou', async () => {
  await recordProject()

  const response = await record(recordPayload({
    events: [
      ...(recordPayload().events as unknown[]),
      { type: 'navigate', timestamp: 5, url: 'https://sistema.test/inicio', selectors: null, label: null, value: null, inputType: null },
      { type: 'navigate', timestamp: 6, url: 'https://sistema.test/inicio/pedidos', selectors: null, label: null, value: null, inputType: null }
    ]
  }))

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain('toHaveURL(/inicio/,')
})

it('confirma o login pelo sumiço do campo de senha quando a gravação não saiu do login', async () => {
  await recordProject()

  const response = await record()

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain('await expect(page.getByTestId(\'pass\')).toBeHidden(')
})

it('mantém a senha real fora do corpo da resposta', async () => {
  await recordProject()

  const response = await record()

  expect(response.status).toBe(200)
  expect(response.text).not.toContain('topsecret123')
})

it('escreve no ambiente as credenciais gravadas', async () => {
  await recordProject()

  await record().expect(200)

  expect(environmentVars()).toContainEqual({ key: EnvKey.USER, value: 'user1', secret: false })
  expect(environmentVars()).toContainEqual({ key: EnvKey.PASSWORD, value: 'topsecret123', secret: true })
  expect(file('.gitignore')).toContain('environments')
})

it('substitui as credenciais que o ambiente já tinha', async () => {
  await recordProject()

  await api.http
    .post(`/api/v1/projects/${SLUG}/auth/credentials`)
    .send({ username: 'antigo', password: 'antiga' })
    .expect(204)

  await record().expect(200)

  expect(environmentVars()).toContainEqual({ key: EnvKey.USER, value: 'user1', secret: false })
  expect(file('environments/ambiente.json')).not.toContain('antigo')
})

it('deixa intacta uma configuração que não consegue interpretar', async () => {
  await recordProject()
  writeFileSync(join(dir, 'playwright.config.ts'), '// configuração escrita pelo usuário')

  await record().expect(200)

  expect(file('playwright.config.ts')).toBe('// configuração escrita pelo usuário')
})

it('ensina uma configuração antiga sobre o setup de autenticação, mantendo o que o usuário escreveu', async () => {
  await recordProject()
  writeFileSync(join(dir, 'playwright.config.ts'), [
    'import { defineConfig } from \'@playwright/test\'',
    '',
    'export default defineConfig({',
    '    testDir: \'./tests\',',
    '    use: {',
    '        launchOptions: { slowMo: 300 },',
    '        baseURL: \'http://localhost:3000\',',
    '    },',
    '})'
  ].join('\n'))

  await record().expect(200)

  const config = file('playwright.config.ts')

  expect(config).toContain('name: \'setup\'')
  expect(config).toContain('auth\\.setup\\.ts')
  expect(config).toContain('name: \'publicos\'')
  expect(config).toContain('name: \'autenticados\'')
  expect(config).toContain('slowMo: 300')
  expect(config).toContain('baseURL: \'http://localhost:3000\'')
})

it('não toca numa configuração que já declara os próprios projects', async () => {
  await recordProject()

  const meu = 'import { defineConfig } from \'@playwright/test\'\nexport default defineConfig({ projects: [{ name: \'meu\' }] })\n'

  writeFileSync(join(dir, 'playwright.config.ts'), meu)

  await record().expect(200)

  expect(file('playwright.config.ts')).toBe(meu)
})

it('pede credenciais quando não consegue extraí-las da gravação', async () => {
  await recordProject()

  const response = await record(recordPayload({
    events: [
      { type: 'navigate', timestamp: 1, url: 'https://sso.test/entrar', selectors: null, label: null, value: null, inputType: null },
      { type: 'click', timestamp: 2, url: 'https://sso.test/entrar', selectors: { dataTestId: 'sso' }, label: 'Entrar com SSO', value: null, inputType: null }
    ]
  }))

  expect(response.status).toBe(200)
  expect(response.body.credentialsNeeded).toBe(true)

  expect(existsSync(join(dir, 'tests/auth.setup.ts'))).toBe(true)
  expect(environmentVars().find(variable => variable.key === EnvKey.USER)?.value).toBe('')
})

it('persiste os eventos gravados para o corretor ler depois, com as credenciais marcadas', async () => {
  await recordProject()

  await record().expect(200)

  const events = JSON.parse(file('tests/auth.events.json'))

  expect(events).toHaveLength(4)
  expect(events[2].value).toBe(`{{${EnvKey.PASSWORD}}}`)
  expect(events[1].value).toBe(`{{${EnvKey.USER}}}`)
})

it('escreve o html capturado do login em arquivo próprio, fora dos eventos', async () => {
  await recordProject()

  const events = recordPayload().events as Record<string, unknown>[]

  events[1]!.html = '<form><input name="user"><input name="pass"></form>'

  await record(recordPayload({ events })).expect(200)

  expect(file('tests/auth.events.json')).not.toContain('<form')
  expect(JSON.parse(file('tests/auth.dom.json'))).toEqual({
    1: '<form><input name="user"><input name="pass"></form>'
  })
})

it('escreve o gherkin do login ao lado do setup', async () => {
  await recordProject()
  await configureAi()

  await record().expect(200)

  expect(file('features/auth.feature')).toContain('Funcionalidade: Entrar no sistema')
})

/** Sem provedor ativo o login continua sendo gravado: o que some é a descrição, que é o que a IA escrevia. */
it('escreve o setup do login sem feature quando não há provedor de ia cadastrado', async () => {
  await recordProject()

  const response = await record()

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain('setup(\'autenticação\'')

  expect(existsSync(join(dir, 'tests/auth.setup.ts'))).toBe(true)
  expect(existsSync(join(dir, 'features/auth.feature'))).toBe(false)
  expect(vi.mocked(writeGherkin)).not.toHaveBeenCalled()
})

it('mantém a feature de autenticação no caminho fixo, qualquer que seja o domínio sugerido', async () => {
  await recordProject()
  await configureAi()

  await record().expect(200)

  expect(existsSync(join(dir, 'features/auth.feature'))).toBe(true)
  expect(existsSync(join(dir, 'features/acesso/auth.feature'))).toBe(false)
})

it('mostra ao escritor de gherkin os mesmos eventos marcados, nunca a senha real', async () => {
  await recordProject()
  await configureAi()

  await record().expect(200)

  const [config, input] = vi.mocked(writeGherkin).mock.calls[0]!
  const prompt = JSON.stringify(input)

  expect(config.provider).toBe('ollama')
  expect(prompt).toContain(`{{${EnvKey.PASSWORD}}}`)
  expect(prompt).not.toContain('topsecret123')
})

it('devolve 404 para um projeto que não existe', async () => {
  const response = await api.http
    .post('/api/v1/projects/inexistente/auth/record')
    .send(recordPayload())

  expect(response.status).toBe(404)
})

it('valida o payload da gravação', async () => {
  await recordProject()

  const response = await record({ events: [] })

  expect(response.status).toBe(422)
  expect(response.body.errors).toHaveProperty('baseUrl')
  expect(response.body.errors).toHaveProperty('events')
})

it('deixa intacta uma url base que o usuário configurou', async () => {
  await recordProject()
  writeFileSync(join(dir, '.env'), `${EnvKey.URL}=https://escolhida-pelo-usuario.test\n`)

  await record().expect(200)

  expect(dotenv()).toContain(`${EnvKey.URL}=https://escolhida-pelo-usuario.test`)
  expect(dotenv()).not.toContain('sistema.test/login')
})

it('monta toda url a partir da chave de ambiente da url base', async () => {
  await recordProject()

  const response = await record()

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain(`const base = process.env.${EnvKey.URL}`)
  expect(response.body.authSetup).not.toContain('https://sistema.test')
})

it('nunca repete o caminho que a url base já carrega', async () => {
  await recordProject()

  const response = await record(recordPayload({
    baseUrl: 'https://sistema.test/intranet',
    events: [
      { type: 'navigate', timestamp: 1, url: 'https://sistema.test/intranet/login', selectors: null, label: null, value: null, inputType: null },
      { type: 'fill', timestamp: 2, url: 'https://sistema.test/intranet/login', selectors: { dataTestId: 'user' }, label: 'Usuário', value: 'user1', inputType: 'text' },
      { type: 'fill', timestamp: 3, url: 'https://sistema.test/intranet/login', selectors: { dataTestId: 'pass' }, label: 'Senha', value: 'topsecret123', inputType: 'password' },
      { type: 'submit', timestamp: 4, url: 'https://sistema.test/intranet/login', selectors: { dataTestId: 'entrar' }, label: 'Entrar', value: null, inputType: null },
      { type: 'navigate', timestamp: 5, url: 'https://sistema.test/intranet/', selectors: null, label: null, value: null, inputType: null }
    ]
  }))

  expect(response.status).toBe(200)
  expect(response.body.authSetup).not.toContain('${base}/intranet')
})

it('sempre fecha o setup salvando a sessão, sem passar pelo corretor', async () => {
  await recordProject()

  const response = await record()

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain(
    `await page.context().storageState({ path: process.env.${EnvKey.STORAGE_STATE} || 'storage-state.json' })`
  )
  expect(vi.mocked(fixSpec)).not.toHaveBeenCalled()
})

it('confere a url por padrão, nunca por igualdade exata', async () => {
  await recordProject()

  const response = await record(recordPayload({
    events: [
      ...(recordPayload().events as unknown[]),
      { type: 'navigate', timestamp: 5, url: 'https://sistema.test/inicio', selectors: null, label: null, value: null, inputType: null }
    ]
  }))

  expect(response.status).toBe(200)
  expect(response.body.authSetup).toContain('toHaveURL(/inicio/,')
  expect(response.body.authSetup).not.toContain('toHaveURL(`')
})

it('nunca chama o corretor quando o setup gerado não quebra regra', async () => {
  await recordProject()
  await configureAi()

  await record().expect(200)

  expect(vi.mocked(fixSpec)).not.toHaveBeenCalled()
})

it('conta como preenchidas as credenciais que esta gravação carrega, para o setup não ser acusado', async () => {
  await recordProject()

  const response = await record()

  expect(response.status).toBe(200)
  expect(response.body.warnings).toEqual([])
})
