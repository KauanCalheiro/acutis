// @vitest-environment node
/** Correção e sugestões com provedor de IA cadastrado: o modelo entra como dublê. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { SettingsService } from '../../settings/settings.service.js'

const { fixSpec, suggestSelectors } = vi.hoisted(() => ({
  fixSpec: vi.fn(),
  suggestSelectors: vi.fn()
}))

vi.mock('../agents/spec-fixer.js', () => ({ fixSpec }))

vi.mock('../agents/selector.js', async importOriginal => ({
  ...await importOriginal<typeof import('../agents/selector.js')>(),
  suggestSelectors
}))

let api: Harness
let dir: string

const SLUG = 'minha-loja'
/** URL absoluta: é uma das violações que as regras apontam, e é ela que vai junto ao modelo. */
const SPEC = 'await page.goto(\'https://app.test/login\')'

function write(relative: string, contents: string): void {
  const file = join(dir, relative)

  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, contents)
}

beforeEach(async () => {
  fixSpec.mockReset()
  suggestSelectors.mockReset()

  api = await startApi([])
  dir = api.projectPath(SLUG)

  write('acutis.json', JSON.stringify({ name: 'Minha Loja', slug: SLUG, created_at: '2026-01-01T00:00:00+00:00', version: 1 }))
  write('tests/login.spec.ts', SPEC)

  // Ollama é keyless: provedor e modelo bastam para o backend achar que pode chamar o modelo.
  await api.get<SettingsService>(SettingsService).update({ provider: 'ollama', model: 'llama3' })
})

afterEach(async () => {
  await api.close()
})

function events(list: object[]): void {
  write('tests/login.events.json', JSON.stringify(list))
}

function environment(url: string): void {
  write('environments/ambiente.json', JSON.stringify({
    name: 'Ambiente',
    vars: [{ key: 'URL', value: url, secret: false }]
  }))
}

function fix() {
  return api.http
    .post(`/api/v1/projects/${SLUG}/scenarios/login/fix`)
    .send({ step: 'Quando preencho o campo', error: 'locator(\'#v-0\') resolved to hidden' })
}

function suggestions() {
  return api.http.post(`/api/v1/projects/${SLUG}/scenarios/login/suggestions`)
}

it('manda ao modelo o spec, os eventos e o que as regras apontaram', async () => {
  events([{ type: 'fill', label: 'Usuário', url: 'https://app.test/login', selectors: { id: 'v-0' } }])
  environment('https://app.test')
  fixSpec.mockResolvedValue({ playwright: 'corrigido', summary: 'Troquei o seletor' })

  const response = await fix()

  expect(response.status).toBe(200)
  expect(response.body).toEqual({ playwright: 'corrigido', summary: 'Troquei o seletor' })

  const [, input] = fixSpec.mock.calls[0]!

  expect(input.spec).toBe(SPEC)
  expect(input.events).toHaveLength(1)
  expect(input.violations.map((violation: { rule: string }) => violation.rule)).toContain('url-absoluta')
})

it('não tem regra a apontar quando o projeto não declara URL base', async () => {
  events([{ type: 'fill', label: 'Usuário', selectors: { id: 'v-0' } }])
  fixSpec.mockResolvedValue({ playwright: 'corrigido', summary: 'ok' })

  await fix()

  expect(fixSpec.mock.calls[0]![1].violations).toEqual([])
})

it('liga cada sugestão ao evento pelo index que o modelo recebeu', async () => {
  events([
    { type: 'click', label: 'Entrar', selectors: { testId: 'login-entrar' } },
    { type: 'click', label: 'Sair', selectors: { cssStable: '.btn-sair' } }
  ])
  suggestSelectors.mockResolvedValue({
    suggestions: [{ index: 1, suggestedTestId: 'login-sair', reason: 'classe muda' }]
  })

  const response = await suggestions()

  expect(response.status).toBe(200)
  expect(response.body).toEqual([{
    event: 'click em Sair',
    currentSelector: '.btn-sair',
    suggestedTestId: 'login-sair',
    reason: 'classe muda'
  }])
})

it('descarta sugestão para index que não existe na gravação', async () => {
  events([{ type: 'click', label: 'Sair', selectors: { cssStable: '.btn-sair' } }])
  suggestSelectors.mockResolvedValue({
    suggestions: [{ index: 99, suggestedTestId: 'nada', reason: 'chute' }]
  })

  const response = await suggestions()

  expect(response.body).toEqual([])
})

it('não chama o modelo quando nenhum evento tem seletor frágil', async () => {
  events([
    { type: 'click', label: 'Entrar', selectors: { testId: 'login-entrar' } },
    { type: 'click', label: 'Sem seletor' }
  ])

  const response = await suggestions()

  expect(response.body).toEqual([])
  expect(suggestSelectors).not.toHaveBeenCalled()
})
