import { describe, expect, it } from 'vitest'
import { describeRecorderEvent } from '~/utils/recorder-event'
import type { RecorderEvent } from '~/composables/webdriver'

function event(partial: Record<string, unknown>): RecorderEvent {
  return partial as unknown as RecorderEvent
}

describe('describeRecorderEvent', () => {
  it('descreve a navegação pelo caminho da URL', () => {
    expect(describeRecorderEvent(event({ type: 'navigate', url: 'http://loja.test/login' })))
      .toBe('Navega para "/login"')
  })

  it('chama a raiz de página inicial', () => {
    expect(describeRecorderEvent(event({ type: 'navigate', url: 'http://loja.test/' })))
      .toBe('Navega para a página inicial')
    expect(describeRecorderEvent(event({ type: 'navigate' })))
      .toBe('Navega para a página inicial')
  })

  it('usa o rótulo do elemento no clique e no hover', () => {
    expect(describeRecorderEvent(event({ type: 'click', label: 'Entrar' }))).toBe('Clica em "Entrar"')
    expect(describeRecorderEvent(event({ type: 'hover', innerText: 'Menu' }))).toBe('Passa o mouse em "Menu"')
  })

  it('fala do elemento genérico quando não há como nomeá-lo', () => {
    expect(describeRecorderEvent(event({ type: 'click' }))).toBe('Clica no elemento')
    expect(describeRecorderEvent(event({ type: 'hover', label: '   ' }))).toBe('Passa o mouse no elemento')
    expect(describeRecorderEvent(event({ type: 'assert' }))).toBe('Confere o elemento')
  })

  it('cai no placeholder e no texto do seletor quando falta rótulo', () => {
    expect(describeRecorderEvent(event({ type: 'fill', selectors: { placeholder: 'E-mail' }, value: 'a@b.c' })))
      .toBe('Preenche "E-mail" com "a@b.c"')
    expect(describeRecorderEvent(event({ type: 'click', selectors: { text: 'Salvar\n  agora' } })))
      .toBe('Clica em "Salvar agora"')
  })

  it('esconde o valor sensível do preenchimento', () => {
    expect(describeRecorderEvent(event({ type: 'fill', label: 'Senha', value: 'segredo', sensitive: true })))
      .toBe('Preenche "Senha" com ••••')
  })

  it('omite o valor quando o campo ficou vazio', () => {
    expect(describeRecorderEvent(event({ type: 'fill' }))).toBe('Preenche o campo')
  })

  it('descreve o envio do formulário e a conferência', () => {
    expect(describeRecorderEvent(event({ type: 'submit' }))).toBe('Envia o formulário')
    expect(describeRecorderEvent(event({ type: 'assert', label: 'Bem-vindo' }))).toBe('Confere "Bem-vindo"')
  })

  it('cai no que sobrou quando o tipo é desconhecido', () => {
    expect(describeRecorderEvent(event({ type: 'wheel', label: 'Rolagem' }))).toBe('Rolagem')
    expect(describeRecorderEvent(event({ type: 'wheel', url: 'http://loja.test' }))).toBe('http://loja.test')
    expect(describeRecorderEvent(event({}))).toBe('')
  })

  it('cita a URL crua quando ela não é um endereço válido', () => {
    expect(describeRecorderEvent(event({ type: 'navigate', url: 'http://[' }))).toBe('Navega para "http://["')
  })
})
