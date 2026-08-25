// @vitest-environment node
import { createApp, createRouter, toWebHandler } from 'h3'
import { describe, expect, it } from 'vitest'
import erro, { erroDeTeste } from '../../server/routes/debug/erro-de-telemetria.get'

const fetchApp = toWebHandler(createApp().use(createRouter().get('/debug/erro-de-telemetria', erro)))

describe('rota de dev que provoca erro', () => {
  it('não existe fora do desenvolvimento', async () => {
    const response = await fetchApp(new Request('http://acutis.test/debug/erro-de-telemetria'))

    expect(response.status).toBe(404)
  })

  it('fabrica uma mensagem de servidor com stack de verdade', () => {
    const erro = erroDeTeste()

    expect(erro.statusCode).toBe(500)
    expect(erro.data.message).toContain('erro de teste')
    expect(erro.data.stack).toContain('erro-de-telemetria')
  })

  it('deixa uma chave no erro para o redator ter o que limpar', () => {
    expect(erroDeTeste().data.stack).toContain('apiKey: VALOR-FALSO')
  })
})
