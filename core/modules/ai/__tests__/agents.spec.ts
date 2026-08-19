// @vitest-environment node
/** Cada agente é um par instruções + schema; o teste confere o que cada um manda ao modelo. */
import { beforeEach, expect, it, vi } from 'vitest'

const { runAgent } = vi.hoisted(() => ({ runAgent: vi.fn() }))

vi.mock('../providers/agent.js', () => ({ runAgent }))

const { writeGherkin, GherkinSchema } = await import('../agents/gherkin.js')
const { writeMetadata, MetadataSchema } = await import('../agents/metadata.js')
const { pingModel, PingSchema } = await import('../agents/ping.js')
const { fixSpec, FixedSpecSchema } = await import('../agents/spec-fixer.js')
const { suggestSelectors, SuggestionsSchema } = await import('../agents/selector.js')

const CONFIG = { provider: 'ollama', key: null, url: null, model: 'llama3' }

function call() {
  return runAgent.mock.calls[0]!
}

beforeEach(() => {
  runAgent.mockReset()
  runAgent.mockResolvedValue({})
})

it('escreve o gherkin a partir da gravação', async () => {
  const input = { baseUrl: 'https://app.test', events: [], title: 'Login' }

  await writeGherkin(CONFIG as never, input as never)

  expect(call()[0]).toBe(CONFIG)
  expect(call()[1].schema).toBe(GherkinSchema)
  expect(call()[1].instructions).toContain('Gherkin')
  expect(call()[2]).toBe(input)
})

it('escreve título, domínio e tags do cenário', async () => {
  const input = { gherkin: 'Funcionalidade: Login' }

  await writeMetadata(CONFIG as never, input as never)

  expect(call()[1].schema).toBe(MetadataSchema)
  expect(call()[2]).toBe(input)
})

it('pergunta ao modelo se ele responde', async () => {
  await pingModel(CONFIG as never)

  expect(call()[1].schema).toBe(PingSchema)
  expect(call()[2]).toEqual({ ping: true })
})

it('manda o spec e as violações para o consertador', async () => {
  const input = { spec: 'test()', violations: [], events: [] }

  await fixSpec(CONFIG as never, input as never)

  expect(call()[1].schema).toBe(FixedSpecSchema)
  expect(call()[2]).toBe(input)
})

it('manda os alvos frágeis para o batizador de testid', async () => {
  const targets = [{ index: 0, type: 'click', label: 'Entrar', selector: '.btn' }]

  await suggestSelectors(CONFIG as never, targets)

  expect(call()[1].schema).toBe(SuggestionsSchema)
  expect(call()[2]).toBe(targets)
})
