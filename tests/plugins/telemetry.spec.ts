import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import telemetryPlugin from '~/plugins/telemetry.client'

const send = vi.fn()

mockNuxtImport('useTelemetry', () => () => ({
  report: (...args: unknown[]) => send(...args)
}))

type Handler = (error: unknown) => void

function install() {
  const hooks = new Map<string, Handler>()
  const nuxtApp = { hook: (name: string, handler: Handler) => hooks.set(name, handler) }

  ;(telemetryPlugin as unknown as (app: typeof nuxtApp) => void)(nuxtApp)

  return hooks
}

beforeEach(() => {
  send.mockReset()
  send.mockResolvedValue(true)
})

describe('plugin de telemetria da interface', () => {
  it('envia o erro de componente que escapou', () => {
    const error = new Error('render quebrou')

    install().get('vue:error')!(error)

    expect(send).toHaveBeenCalledWith(error, 'Erro na interface', 'vue:error')
  })

  it('envia o erro fatal da aplicação', () => {
    const error = new Error('app quebrou')

    install().get('app:error')!(error)

    expect(send).toHaveBeenCalledWith(error, 'Erro na interface', 'app:error')
  })

  it('não deixa a falha do envio estourar de novo', async () => {
    send.mockRejectedValue(new Error('sem rede'))

    expect(() => install().get('vue:error')!(new Error('boom'))).not.toThrow()
    await new Promise(resolve => setTimeout(resolve, 0))
  })
})
