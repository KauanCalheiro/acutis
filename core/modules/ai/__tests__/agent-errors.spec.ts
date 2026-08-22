// @vitest-environment node
/**
 * O que o usuário lê quando o provedor de IA recusa a chamada. Sem tradução, o erro do SDK sobe cru
 * e a tela mostra "Internal server error".
 */
import { afterEach, expect, it, vi } from 'vitest'
import * as z from 'zod'
import { HttpError } from '../../../common/exceptions/errors.js'
import { runAgent } from '../providers/agent.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** Um provedor que fala HTTP; o Claude Code recusa de outro jeito, coberto em `claude-agent.spec`. */
const CONFIG = {
  provider: 'anthropic',
  key: 'sk-do-teste',
  url: null,
  model: 'claude-sonnet-5'
}

const AGENT = {
  instructions: 'Responda.',
  schema: z.object({ resposta: z.string() })
}

/** O provedor recusa com o status informado, no formato de erro da Anthropic. */
function refuseWith(status: number, type: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify({ type: 'error', error: { type, message: 'Error' } }), { status }))
  )
}

/** O erro do domínio que o `HttpErrorFilter` traduz em resposta. */
async function failureOf(): Promise<HttpError> {
  try {
    await runAgent(CONFIG, AGENT, { pergunta: 'oi' })
  } catch (error) {
    return error as HttpError
  }

  throw new Error('o agente não falhou')
}

it('explica o limite de uso do provedor, com o modelo que o atingiu', async () => {
  refuseWith(429, 'rate_limit_error')

  const failure = await failureOf()

  expect(failure).toBeInstanceOf(HttpError)
  expect(failure.status).toBe(429)
  expect(failure.message).toContain('limite de uso')
  expect(failure.message).toContain('claude-sonnet-5')
  expect(failure.message).not.toContain('rate_limit_error')
})

it('manda conferir a credencial quando o provedor recusa a autenticação', async () => {
  refuseWith(401, 'authentication_error')

  const failure = await failureOf()

  expect(failure).toBeInstanceOf(HttpError)
  expect(failure.message).toContain('credencial')
  expect(failure.message).toContain('anthropic')
})

it('avisa que o modelo não existe naquele provedor', async () => {
  refuseWith(404, 'not_found_error')

  const failure = await failureOf()

  expect(failure.message).toContain('claude-sonnet-5')
  expect(failure.message).toContain('não')
})

/**
 * Falha sem status nenhum (provedor fora do ar, DNS) não pode virar 500 mudo, nem demorar. Com o
 * retry padrão do LangChain eram 7 tentativas e 72s de espera antes de qualquer aviso na tela.
 */
it('desiste do provedor fora do ar depressa, em vez de insistir por um minuto', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => {
    throw new Error('fetch failed')
  }))

  const failure = await failureOf()

  expect(failure).toBeInstanceOf(HttpError)
  expect(failure.message).toContain('anthropic')
  expect(vi.mocked(fetch).mock.calls.length).toBeLessThanOrEqual(2)
}, 30_000)
