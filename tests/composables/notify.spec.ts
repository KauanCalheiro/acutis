import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { useNotify } from '~/composables/notify'

const add = vi.fn()
const send = vi.fn()
const telemetry = { enabled: true }

mockNuxtImport('useToast', () => () => ({ add }))
mockNuxtImport('useTelemetry', () => () => ({
  get enabled() { return telemetry.enabled },
  report: (...args: unknown[]) => send(...args)
}))

beforeEach(() => {
  telemetry.enabled = true
  add.mockClear()
  send.mockClear()
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
  it('deixa a toast de erro na tela por mais tempo, para dar tempo de decidir', () => {
    useNotify().failure(new Error('boom'), 'Não deu')

    expect(add.mock.lastCall![0].duration).toBe(15_000)
  })

  it('oferece o envio do relato no erro', () => {
    useNotify().failure(new Error('boom'), 'Não deu', 'Gerar cenário')

    const [toast] = add.mock.lastCall!
    expect(toast.actions).toHaveLength(1)
    expect(toast.actions[0]).toMatchObject({
      label: 'Enviar logs',
      variant: 'soft',
      block: true
    })
  })

  it('não oferece nada quando não há telemetria configurada', () => {
    telemetry.enabled = false

    useNotify().failure(new Error('boom'), 'Não deu')

    expect(add.mock.lastCall![0].actions).toBeUndefined()
  })

  it('manda o erro e o contexto ao clicar', async () => {
    send.mockResolvedValue(true)
    const error = new Error('boom')

    useNotify().failure(error, 'Não deu', 'Gerar cenário')
    await add.mock.lastCall![0].actions[0].onClick()

    expect(send).toHaveBeenCalledWith(error, 'Não deu', 'Gerar cenário')
  })

  it('agradece quando o relato chega', async () => {
    send.mockResolvedValue(true)

    useNotify().failure(new Error('boom'), 'Não deu')
    await add.mock.lastCall![0].actions[0].onClick()

    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({ color: 'success' }))
  })

  it('avisa quando o relato não chegou', async () => {
    send.mockResolvedValue(false)

    useNotify().failure(new Error('boom'), 'Não deu')
    await add.mock.lastCall![0].actions[0].onClick()

    expect(add).toHaveBeenLastCalledWith(expect.objectContaining({
      title: 'Não foi possível enviar os logs.',
      color: 'warning'
    }))
  })

  it('não deixa a falha do envio virar outro erro na tela', async () => {
    send.mockRejectedValue(new Error('sem rede'))

    useNotify().failure(new Error('boom'), 'Não deu')

    await expect(add.mock.lastCall![0].actions[0].onClick()).resolves.toBeUndefined()
  })
})
