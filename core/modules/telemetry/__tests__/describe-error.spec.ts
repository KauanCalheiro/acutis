// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { describeError } from '../describe-error.js'

describe('describeError', () => {
  it('usa a mensagem e o stack do erro', () => {
    const error = new Error('o navegador não abriu')

    expect(describeError(error)).toEqual({ message: 'o navegador não abriu', stack: error.stack })
  })

  it('acrescenta ao stack a causa original, que é onde está o motivo real', () => {
    const cause = new Error('browserType.launch: Target page, context or browser has been closed')
    const error = new Error('Não foi possível abrir o gravador.', { cause })

    const { stack } = describeError(error)

    expect(stack).toContain('Não foi possível abrir o gravador.')
    expect(stack).toContain(`Causado por: ${cause.stack}`)
  })

  it('segue a cadeia de causas até o fim', () => {
    const root = new Error('ECONNREFUSED 127.0.0.1:9222')
    const middle = new Error('connectOverCDP falhou', { cause: root })
    const error = new Error('Não foi possível conectar ao Chrome.', { cause: middle })

    const { stack } = describeError(error)

    expect(stack).toContain('connectOverCDP falhou')
    expect(stack).toContain('ECONNREFUSED 127.0.0.1:9222')
  })

  it('descreve a causa que não é um Error', () => {
    const error = new Error('falhou', { cause: 'código 137' })

    expect(describeError(error).stack).toContain('Causado por: código 137')
  })

  it('para numa causa que aponta de volta para o próprio erro', () => {
    const error = new Error('circular')
    ;(error as { cause?: unknown }).cause = error

    expect(describeError(error).stack?.match(/Causado por/g)).toHaveLength(1)
  })

  it('descreve o que foi lançado sem ser um Error', () => {
    expect(describeError('texto solto')).toEqual({ message: 'texto solto', stack: undefined })
  })
})
