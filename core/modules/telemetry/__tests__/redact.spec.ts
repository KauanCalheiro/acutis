import { describe, expect, it } from 'vitest'
import { redact } from '../redact.js'

describe('redact', () => {
  it('troca o caminho da home pelo til', () => {
    expect(redact('Erro em /Users/kauan/projeto/spec.ts', { home: '/Users/kauan' }))
      .toBe('Erro em ~/projeto/spec.ts')
  })

  it('troca a home também quando ela aparece várias vezes', () => {
    expect(redact('/Users/kauan/a e /Users/kauan/b', { home: '/Users/kauan' }))
      .toBe('~/a e ~/b')
  })

  it('esconde o valor de uma chave sensível escrita como atribuição', () => {
    expect(redact('token=abc123 no header', {})).toBe('token=[redigido] no header')
  })

  it('esconde o valor de uma chave sensível em JSON', () => {
    expect(redact('{"password":"segredo"}', {})).toBe('{"password":"[redigido]"}')
  })

  it('esconde authorization, secret e apiKey', () => {
    expect(redact('authorization: Bearer xyz', {})).toBe('authorization: [redigido]')
    expect(redact('client_secret=xyz', {})).toBe('client_secret=[redigido]')
    expect(redact('apiKey: "xyz"', {})).toBe('apiKey: "[redigido]"')
  })

  it('esconde o valor de qualquer variável de ambiente conhecida', () => {
    expect(redact('falhou com sk-vazando aqui', { env: { OPENAI_API_KEY: 'sk-vazando' } }))
      .toBe('falhou com [redigido] aqui')
  })

  it('ignora variável de ambiente de valor curto para não picotar o texto', () => {
    expect(redact('o modo era 1 quando falhou', { env: { DEBUG: '1' } }))
      .toBe('o modo era 1 quando falhou')
  })

  it('deixa passar texto sem nada sensível', () => {
    expect(redact('Timeout ao abrir o navegador', {})).toBe('Timeout ao abrir o navegador')
  })

  it('aceita texto indefinido', () => {
    expect(redact(undefined, {})).toBeUndefined()
  })
})
