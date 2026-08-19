// @vitest-environment node
/**
 * O provedor que roda pelo Claude Code instalado na máquina: em vez de HTTP, o SDK conversa com o
 * binário local e cobra da assinatura já autenticada nele.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { runAgent } from '../providers/agent.js'

/** O que o SDK recebeu na última chamada, para o teste conferir o que foi pedido ao Claude Code. */
let pedido: { prompt?: string, options?: Record<string, unknown> }

/** O que o SDK vai responder; cada teste ajusta antes de rodar. */
let resposta: Record<string, unknown>[]

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn((argumentos: { prompt?: string, options?: Record<string, unknown> }) => {
    pedido = argumentos

    return (async function* stream() {
      for (const message of resposta) yield message
    })()
  })
}))

beforeEach(() => {
  pedido = {}
  resposta = [{ type: 'result', subtype: 'success', structured_output: { acao: 'clicar', estavel: true } }]
})

afterEach(() => {
  vi.clearAllMocks()
})

const CONFIG = {
  provider: 'claude-code',
  key: null,
  url: null,
  model: 'claude-sonnet-5'
}

const AGENT = {
  instructions: 'Você classifica um passo de teste.',
  schema: z.object({
    acao: z.string(),
    estavel: z.boolean()
  })
}

it('devolve a saída estruturada que o claude code produziu', async () => {
  const saida = await runAgent(CONFIG, AGENT, { passo: 'clicar em entrar' })

  expect(saida).toEqual({ acao: 'clicar', estavel: true })
})

it('pede ao claude code o modelo cadastrado, sem ferramentas e em um turno só', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'clicar em entrar' })

  expect(pedido.options).toMatchObject({
    model: 'claude-sonnet-5',
    systemPrompt: 'Você classifica um passo de teste.',
    allowedTools: [],
    maxTurns: 1
  })
  expect(pedido.prompt).toContain('clicar em entrar')
})

/**
 * O `z.toJSONSchema` marca o schema com `$schema: draft/2020-12`, e o CLI recusa o que não consegue
 * resolver: `--json-schema is not a valid JSON Schema: no schema with key or ref`.
 */
it('manda o schema do agente sem a marca de versão que o cli recusa', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'clicar em entrar' })

  const formato = pedido.options?.outputFormat as { type: string, schema: Record<string, unknown> }

  expect(formato.type).toBe('json_schema')
  expect(formato.schema.$schema).toBeUndefined()
  expect(formato.schema.properties).toHaveProperty('acao')
})

/** Nada de configuração do projeto ou do usuário vazando para dentro do agente do acutis. */
it('não carrega as configurações locais do claude code', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'clicar em entrar' })

  expect(pedido.options?.settingSources).toEqual([])
})

it('recusa a resposta que não obedece ao schema do agente', async () => {
  resposta = [{ type: 'result', subtype: 'success', structured_output: { acao: 'clicar' } }]

  await expect(runAgent(CONFIG, AGENT, { passo: 'x' })).rejects.toThrow()
})

/**
 * Este provedor depende de um binário na máquina; quem não o tem precisa ler o que instalar, não
 * "Claude Code executable not found at /usr/local/bin/claude".
 */
it('manda instalar e autenticar quando o binário não está na máquina', async () => {
  const { query } = await import('@anthropic-ai/claude-agent-sdk')

  vi.mocked(query).mockImplementationOnce(() => {
    throw new ReferenceError('Claude Code executable not found at /usr/local/bin/claude. Is options.pathToClaudeCodeExecutable set?')
  })

  const falha = await runAgent(CONFIG, AGENT, { passo: 'x' }).catch((error: Error) => error)

  expect(falha.message).toContain('Claude Code')
  expect(falha.message).toContain('claude login')
  expect(falha.message).not.toContain('pathToClaudeCodeExecutable')
})

/** O SDK reporta o erro no próprio resultado; sem isto o schema falharia com uma mensagem confusa. */
it('explica a falha que o claude code reportou no resultado', async () => {
  resposta = [{ type: 'result', subtype: 'error_during_execution', is_error: true, errors: ['limite atingido'] }]

  await expect(runAgent(CONFIG, AGENT, { passo: 'x' })).rejects.toThrow(/claude-code/)
})
