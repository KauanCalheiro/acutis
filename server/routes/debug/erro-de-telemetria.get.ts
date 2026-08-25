import { createError, defineEventHandler } from 'h3'

/** A falha fabricada: mensagem de servidor, stack de verdade e uma chave para o redator limpar. */
export function erroDeTeste() {
  const causa = new Error('O provedor de IA recusou a chamada com apiKey: VALOR-FALSO-SO-PARA-O-REDATOR-LIMPAR')

  return createError({
    statusCode: 500,
    data: {
      message: `Não foi possível gerar o cenário. Este é um erro de teste, em ${new Date().toISOString()}.`,
      stack: causa.stack
    }
  })
}

export default defineEventHandler(() => {
  if (!import.meta.dev) throw createError({ statusCode: 404 })

  throw erroDeTeste()
})
