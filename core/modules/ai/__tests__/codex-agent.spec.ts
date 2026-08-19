// @vitest-environment node
/**
 * O provedor que roda pelo Codex instalado na máquina: em vez de HTTP, o SDK conversa com o binário
 * local e cobra da assinatura já autenticada nele.
 */
import { existsSync } from 'node:fs'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { runAgent } from '../providers/agent.js'

/** O que o SDK recebeu na última chamada, para o teste conferir o que foi pedido ao Codex. */
let pedido: {
  options?: Record<string, unknown>
  thread?: Record<string, unknown>
  input?: string
  turn?: Record<string, unknown>
}

/** O que o SDK vai responder; cada teste ajusta antes de rodar. */
let resposta: () => { finalResponse: string }

vi.mock('@openai/codex-sdk', () => ({
  Codex: class {
    constructor(private readonly options: Record<string, unknown>) {}

    startThread(thread: Record<string, unknown>) {
      pedido.options = this.options
      pedido.thread = thread

      return {
        run: (input: string, turn: Record<string, unknown>) => {
          pedido.input = input
          pedido.turn = turn

          return Promise.resolve(resposta())
        }
      }
    }
  }
}))

beforeEach(() => {
  pedido = {}
  resposta = () => ({ finalResponse: JSON.stringify({ acao: 'clicar', estavel: true }) })
})

afterEach(() => {
  vi.clearAllMocks()
})

const CONFIG = {
  provider: 'codex',
  key: null,
  url: null,
  model: 'gpt-5.6-sol'
}

const AGENT = {
  instructions: 'Você classifica um passo de teste.',
  schema: z.object({
    acao: z.string(),
    estavel: z.boolean()
  })
}

it('devolve a saída estruturada que o codex produziu', async () => {
  const saida = await runAgent(CONFIG, AGENT, { passo: 'clicar em entrar' })

  expect(saida).toEqual({ acao: 'clicar', estavel: true })
})

it('manda as instruções e o input do agente no prompt', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'clicar em entrar' })

  expect(pedido.input).toContain('Você classifica um passo de teste.')
  expect(pedido.input).toContain('clicar em entrar')
})

it('pede ao codex o modelo cadastrado, sem escrever em disco nem sair para a rede', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'clicar em entrar' })

  expect(pedido.thread).toMatchObject({
    model: 'gpt-5.6-sol',
    sandboxMode: 'read-only',
    approvalPolicy: 'never',
    networkAccessEnabled: false,
    webSearchEnabled: false,
    skipGitRepoCheck: true
  })
})

it('usa o modelo padrão quando o cadastro não escolheu nenhum', async () => {
  await runAgent({ ...CONFIG, model: null }, AGENT, { passo: 'x' })

  expect(pedido.thread?.model).toBe('gpt-5.6-sol')
})

/** Sem isto, um `AGENTS.md` na pasta de trabalho manda no agente do acutis. */
it('não deixa o documento do projeto entrar no prompt', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'x' })

  expect(pedido.options?.config).toMatchObject({ project_doc_max_bytes: 0 })
})

it('roda o binário que está no caminho configurado', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'x' })

  expect(pedido.options?.codexPathOverride).toBe('codex')
})

it('trabalha numa pasta vazia e a apaga ao terminar', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'x' })

  const pasta = pedido.thread?.workingDirectory as string

  expect(pasta).toContain('acutis-codex-')
  expect(existsSync(pasta)).toBe(false)
})

/** O `z.toJSONSchema` marca o schema com `$schema: draft/2020-12`, que o CLI não resolve. */
it('manda o schema do agente sem a marca de versão que o cli recusa', async () => {
  await runAgent(CONFIG, AGENT, { passo: 'x' })

  const schema = pedido.turn?.outputSchema as Record<string, unknown>

  expect(schema.$schema).toBeUndefined()
  expect(schema.properties).toHaveProperty('acao')
})

it('recusa a resposta que não obedece ao schema do agente', async () => {
  resposta = () => ({ finalResponse: JSON.stringify({ acao: 'clicar' }) })

  await expect(runAgent(CONFIG, AGENT, { passo: 'x' })).rejects.toThrow()
})

it('recusa a resposta que não é json', async () => {
  resposta = () => ({ finalResponse: 'não consegui responder' })

  await expect(runAgent(CONFIG, AGENT, { passo: 'x' })).rejects.toThrow()
})

/** Quem não tem o binário precisa ler o que instalar, não "spawn codex ENOENT". */
it('manda instalar e autenticar quando o binário não está na máquina', async () => {
  resposta = () => {
    throw Object.assign(new Error('spawn codex ENOENT'), { code: 'ENOENT' })
  }

  const falha = await runAgent(CONFIG, AGENT, { passo: 'x' }).catch((error: Error) => error)

  expect(falha.message).toContain('Codex')
  expect(falha.message).toContain('codex login')
  expect(falha.message).not.toContain('ENOENT')
})

/** O binário responde 401 quando ninguém rodou `codex login` nesta máquina. */
it('manda autenticar quando o codex não está logado', async () => {
  resposta = () => {
    throw new Error('unexpected status 401 Unauthorized: Missing bearer or basic authentication in header')
  }

  const falha = await runAgent(CONFIG, AGENT, { passo: 'x' }).catch((error: Error) => error)

  expect(falha.message).toContain('codex login')
})

/** A assinatura ChatGPT recusa parte dos modelos com 400, não com 404. */
it('explica que a assinatura não aceita o modelo escolhido', async () => {
  resposta = () => {
    throw new Error('{"type":"error","status":400,"error":{"type":"invalid_request_error","message":"The \'gpt-5.6-pro\' model is not supported when using Codex with a ChatGPT account."}}')
  }

  const falha = await runAgent(CONFIG, AGENT, { passo: 'x' }).catch((error: Error) => error)

  expect(falha.message).toContain('gpt-5.6-sol')
  expect(falha.message).toContain('assinatura')
})
