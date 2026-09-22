// @vitest-environment node
/** A ordem em que os seletores gravados são tentados, e o que o projeto pode dizer sobre ela. */
import { describe, expect, it } from 'vitest'
import { chooseSelector, DEFAULT_SELECTOR_PRIORITY, selectorOrder } from '../selector-priority.js'
import { selectors } from '../../../../test/support/fixtures.js'

describe('selectorOrder', () => {
  it('usa a ordem padrão quando o projeto não configurou nada', () => {
    expect(selectorOrder(undefined)).toEqual(DEFAULT_SELECTOR_PRIORITY)
    expect(selectorOrder(null)).toEqual(DEFAULT_SELECTOR_PRIORITY)
    expect(selectorOrder([])).toEqual(DEFAULT_SELECTOR_PRIORITY)
  })

  it('respeita a ordem que o projeto escolheu', () => {
    const order = selectorOrder(['xpath', 'dataTestId'])

    expect(order.slice(0, 2)).toEqual(['xpath', 'dataTestId'])
  })

  it('completa no fim o que o projeto não listou, sem perder nenhuma entrada', () => {
    const order = selectorOrder(['xpath'])

    expect(order).toHaveLength(DEFAULT_SELECTOR_PRIORITY.length)
    expect([...order].sort()).toEqual([...DEFAULT_SELECTOR_PRIORITY].sort())
  })

  it('ignora o nome que não é seletor conhecido', () => {
    expect(selectorOrder(['data-inventado', 'xpath'])[0]).toBe('xpath')
  })

  it('ignora a repetição, mantendo a primeira posição pedida', () => {
    const order = selectorOrder(['xpath', 'dataTestId', 'xpath'])

    expect(order).toHaveLength(DEFAULT_SELECTOR_PRIORITY.length)
    expect(order.slice(0, 2)).toEqual(['xpath', 'dataTestId'])
  })
})

describe('chooseSelector', () => {
  it('escolhe o primeiro da ordem que o elemento gravou', () => {
    const gravados = selectors({ id: 'salvar', xpath: '/html[1]/body[1]/button[1]' })

    expect(chooseSelector(gravados, DEFAULT_SELECTOR_PRIORITY)).toBe('id')
  })

  it('escolhe o xpath quando o projeto o colocou na frente do id', () => {
    const gravados = selectors({ id: 'salvar', xpath: '/html[1]/body[1]/button[1]' })

    expect(chooseSelector(gravados, selectorOrder(['xpath']))).toBe('xpath')
  })

  it('pula a entrada que o elemento não tem, mesmo sendo a primeira da ordem', () => {
    const gravados = selectors({ dataCy: 'salvar' })

    expect(chooseSelector(gravados, DEFAULT_SELECTOR_PRIORITY)).toBe('dataCy')
  })

  it('devolve nada quando o elemento não gravou seletor nenhum', () => {
    expect(chooseSelector(selectors(), DEFAULT_SELECTOR_PRIORITY)).toBeNull()
    expect(chooseSelector(null, DEFAULT_SELECTOR_PRIORITY)).toBeNull()
  })
})
