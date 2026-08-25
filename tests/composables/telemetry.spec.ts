import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { DEFAULT_TELEMETRY_URL } from '@acutis/core/config/telemetry-endpoint'
import { useTelemetry } from '~/composables/telemetry'

const send = vi.fn()

mockNuxtImport('$fetch', () => (...args: unknown[]) => send(...args))

beforeEach(() => {
  send.mockReset()
})

describe('useTelemetry', () => {
  it('segue a url que o build embutiu', () => {
    expect(useTelemetry().enabled).toBe(DEFAULT_TELEMETRY_URL !== '')
  })

  it('manda a mesma mensagem que a tela mostrou, com stack e contexto', async () => {
    send.mockResolvedValue({ sent: true })
    const error = new Error('boom')

    await expect(useTelemetry().report(error, 'Não deu', 'Gerar cenário')).resolves.toBe(true)
    expect(send).toHaveBeenCalledWith('/api/telemetry/report', {
      method: 'POST',
      body: { message: 'Não deu', stack: error.stack, context: 'Gerar cenário' }
    })
  })

  it('prefere o stack do servidor ao do fetch no browser', async () => {
    send.mockResolvedValue({ sent: true })
    const doServidor = 'Error: boom\n    at RunnerService.execute (/core/runner.service.ts:58:9)'
    const doBrowser = new Error('[GET] "/api/x": 500 Server Error')
    Object.assign(doBrowser, { data: { data: { message: 'Falhou', stack: doServidor } } })

    await useTelemetry().report(doBrowser, 'Não deu')

    expect(send.mock.lastCall![1].body.stack).toBe(doServidor)
  })

  it('usa o stack do browser quando o servidor não mandou o dele', async () => {
    send.mockResolvedValue({ sent: true })
    const erro = new Error('boom')

    await useTelemetry().report(erro, 'Não deu')

    expect(send.mock.lastCall![1].body.stack).toBe(erro.stack)
  })

  it('prefere a explicação do servidor quando ela existe', async () => {
    send.mockResolvedValue({ sent: true })

    await useTelemetry().report({ data: { data: { message: 'Slug já existe' } } }, 'Não deu')

    expect(send.mock.lastCall![1].body.message).toBe('Slug já existe')
  })

  it('usa o texto de reserva quando o erro não tem mensagem', async () => {
    send.mockResolvedValue({ sent: true })

    await useTelemetry().report({}, 'Não deu')

    expect(send.mock.lastCall![1].body.message).toBe('Não deu')
  })

  it('devolve falso quando a rota falha, sem estourar', async () => {
    send.mockRejectedValue(new Error('sem rede'))

    await expect(useTelemetry().report(new Error('boom'), 'Não deu')).resolves.toBe(false)
  })
})
