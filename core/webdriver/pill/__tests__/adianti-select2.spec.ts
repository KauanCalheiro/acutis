// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { useSelectorCapture } from '../useSelectorCapture'
import { COMBO_COM_RESULTADOS, DOIS_COMBOS } from './adianti-fixture'

describe('combos select2 do Adianti', () => {
  const { extractSelectors } = useSelectorCapture()

  function openFirstCombo(): void {
    document.querySelector('.select2-container')!.classList.add('select2-container--below', 'select2-container--open')
  }

  function rendered(name: string): Element {
    return document.querySelector(`select[name="${name}"] + .select2-container .select2-selection__rendered`)!
  }

  beforeEach(() => {
    document.body.innerHTML = DOIS_COMBOS
  })

  it('não usa a classe que só existe com o dropdown aberto', () => {
    openFirstCombo()

    expect(extractSelectors(rendered('aluno_origem')).finder).not.toMatch(/--open|--below/)
  })

  it('ancora o combo clicado no select que o Adianti nomeia', () => {
    openFirstCombo()

    expect(extractSelectors(rendered('aluno_origem')).cssStable)
      .toBe('select[name="aluno_origem"] + * .select2-selection__rendered')
  })

  it('distingue o segundo combo pelo select dele', () => {
    expect(extractSelectors(rendered('curriculo_destino')).cssStable)
      .toBe('select[name="curriculo_destino"] + * .select2-selection__rendered')
  })

  it('o seletor ancorado continua achando o combo depois que o dropdown fecha', () => {
    openFirstCombo()
    const { cssStable } = extractSelectors(rendered('aluno_origem'))
    document.body.innerHTML = DOIS_COMBOS

    expect(document.querySelectorAll(cssStable!)).toHaveLength(1)
  })

  it('aceita o texto da opção quando o gêmeo é o option do select escondido', () => {
    document.body.innerHTML = COMBO_COM_RESULTADOS
    const selectors = extractSelectors(document.querySelector('li[role="option"]')!)

    expect(selectors.text).toBe('481221 Engenharia de Software')
    expect(selectors.textHiddenTwins).toBe(true)
  })
})
