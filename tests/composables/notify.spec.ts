import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useNotify } from '~/composables/notify'

const add = vi.fn()
const send = vi.fn()

mockNuxtImport('useToast', () => () => ({ add }))
mockNuxtImport('useTelemetry', () => () => ({
  report: (...args: unknown[]) => send(...args)
}))

beforeEach(() => {
  add.mockClear()
  send.mockReset()
  send.mockResolvedValue(true)
})

describe('useNotify', () => {
  it('mostra o sucesso em verde', () => {
    useNotify().success('Projeto criado')

    expect(add).toHaveBeenCalledWith({
      title: 'Projeto criado',
      color: 'success',
      icon: 'i-ic-round-check-circle'
    })
  })

  it('mostra o que o servidor explicou em vermelho', () => {
    useNotify().failure({ data: { data: { message: 'Slug já existe' } } }, 'Não deu')

    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({
      title: 'Slug já existe',
      color: 'error',
      icon: 'i-ic-round-error'
    }))
  })

  it('usa o texto de reserva quando o erro não diz nada', () => {
    useNotify().failure(new Error('boom'), 'Não deu')

    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({ title: 'Não deu' }))
  })
})

describe('useNotify com telemetria', () => {
  it('mostra o erro sem ação de envio', () => {
    useNotify().failure(new Error('boom'), 'Não deu', 'Gerar cenário')

    expect(add.mock.lastCall![0].actions).toBeUndefined()
  })

  it('deixa a toast de erro com a duração padrão', () => {
    useNotify().failure(new Error('boom'), 'Não deu')

    expect(add.mock.lastCall![0].duration).toBeUndefined()
  })

  it('envia o relato sozinho com o erro, o texto de reserva e o contexto', () => {
    const error = new Error('boom')

    useNotify().failure(error, 'Não deu', 'Gerar cenário')

    expect(send).toHaveBeenCalledWith(error, 'Não deu', 'Gerar cenário')
  })

  it('não mostra nada na tela sobre o envio', async () => {
    useNotify().failure(new Error('boom'), 'Não deu')
    await Promise.resolve()

    expect(add).toHaveBeenCalledOnce()
  })

  it('não deixa a falha do envio virar outro erro na tela', async () => {
    send.mockRejectedValue(new Error('sem rede'))

    expect(() => useNotify().failure(new Error('boom'), 'Não deu')).not.toThrow()
    await new Promise(resolve => setTimeout(resolve, 0))

    expect(add).toHaveBeenCalledOnce()
  })
})
