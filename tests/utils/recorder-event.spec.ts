import { describe, expect, it } from 'vitest'
import { describeRecorderEvent, toRecordedEvents } from '~/utils/recorder-event'
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

  it('leva para o backend o que a asserção afirma, e não só que houve uma', () => {
    const gravados = toRecordedEvents([
      {
        event: 'recorder:assert',
        type: 'assert',
        url: 'http://loja.test/carrinho',
        selectors: { dataTestId: 'total' },
        label: 'Total',
        innerText: 'R$ 10,00',
        tagName: 'span',
        checked: null,
        inputType: null,
        assert: { assertType: 'text', expectedValue: 'R$ 10,00' }
      }
    ] as unknown as RecorderEvent[])

    expect(gravados[0]).toMatchObject({
      type: 'assert',
      innerText: 'R$ 10,00',
      tagName: 'span',
      assert: { assertType: 'text', expectedValue: 'R$ 10,00' }
    })
  })

  it('não manda o que é só do transporte do websocket', () => {
    const gravados = toRecordedEvents([
      { event: 'recorder:click', type: 'click', sessionId: 'abc', url: 'http://loja.test' }
    ] as unknown as RecorderEvent[])

    expect(gravados[0]).not.toHaveProperty('event')
    expect(gravados[0]).not.toHaveProperty('sessionId')
  })

  it('diz que o assert de URL é sobre a tela, e não sobre um elemento dela', () => {
    const naTela = event({
      type: 'assert',
      label: 'Plataforma Univates',
      url: 'http://loja.test/financeiro',
      assert: { assertType: 'url', expectedValue: 'http://loja.test/financeiro' }
    })

    expect(describeRecorderEvent(naTela)).toBe('Confere que a tela é "/financeiro"')

    const naRaiz = event({
      type: 'assert',
      url: 'http://loja.test/',
      assert: { assertType: 'url', expectedValue: 'http://loja.test/' }
    })

    expect(describeRecorderEvent(naRaiz)).toBe('Confere que a tela é a página inicial')
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
