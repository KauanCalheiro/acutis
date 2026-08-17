import { describe, expect, it } from 'vitest'
import { extractServerError } from '~/utils/api-error'

describe('extractServerError', () => {
  it('prefere a primeira mensagem de validação do campo', () => {
    const error = { data: { data: { message: 'Erro geral', errors: { name: ['Nome obrigatório'] } } } }

    expect(extractServerError(error, 'Falhou')).toBe('Nome obrigatório')
  })

  it('cai na mensagem do servidor quando não há erro de campo', () => {
    expect(extractServerError({ data: { data: { message: 'Projeto não existe' } } }, 'Falhou'))
      .toBe('Projeto não existe')
  })

  it('usa o texto de reserva quando o servidor não explicou nada', () => {
    expect(extractServerError({}, 'Falhou')).toBe('Falhou')
    expect(extractServerError({ data: { data: { errors: {} } } }, 'Falhou')).toBe('Falhou')
  })
})
