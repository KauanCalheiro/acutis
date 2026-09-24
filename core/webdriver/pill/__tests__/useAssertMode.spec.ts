// @vitest-environment jsdom
/** O modo de conferência da pill: escolher um elemento e gravar o que se espera dele. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { RecordingEvent } from '@/common/types/recording'
import { useAssertMode } from '../useAssertMode'
import { usePillState } from '../usePillState'

function element(rect: Partial<DOMRect>): Element {
  document.body.innerHTML = '<button id="alvo">Entrar</button>'
  const el = document.querySelector('button')!

  el.getBoundingClientRect = () => ({ top: 0, left: 0, width: 0, height: 0, bottom: 0, ...rect }) as DOMRect

  return el
}

function captured(): RecordingEvent[] {
  const enviados: RecordingEvent[] = []

  window.__acutisReportEvent = (event) => {
    enviados.push(event as RecordingEvent)
  }

  return enviados
}

beforeEach(() => {
  vi.stubGlobal('innerWidth', 1000)
  vi.stubGlobal('innerHeight', 800)
})

afterEach(() => {
  useAssertMode().deactivateAssertMode()
  vi.unstubAllGlobals()
})

it('liga e desliga o modo de conferência', () => {
  const assertMode = useAssertMode()
  const { captureMode } = usePillState()

  assertMode.activateAssertMode()
  expect(captureMode.value).toBe('assert')

  assertMode.deactivateAssertMode()
  expect(captureMode.value).toBeNull()
  expect(assertMode.isPopoverVisible.value).toBe(false)
})

it('abre o balão acima do elemento com espaço em cima', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 400, bottom: 430, left: 300, width: 100, height: 30 }))

  expect(assertMode.isPopoverVisible.value).toBe(true)
  expect(assertMode.popoverPosition.value).toMatchObject({ above: true, left: 190 })
  expect(assertMode.popoverPosition.value.vertical).toBe(800 - 400 + 12 + 12)
})

it('abre o balão abaixo quando não cabe em cima', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 10, bottom: 40, left: 300, width: 100, height: 30 }))

  expect(assertMode.popoverPosition.value).toMatchObject({ above: false })
  expect(assertMode.popoverPosition.value.vertical).toBe(40 + 12 + 12)
})

it('não deixa o balão sair da tela pela esquerda nem pela direita', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 400, bottom: 430, left: 0, width: 10, height: 30 }))
  expect(assertMode.popoverPosition.value.left).toBe(16)
  expect(assertMode.popoverPosition.value.arrowLeft).toBe(16)

  assertMode.handleElementClick(element({ top: 400, bottom: 430, left: 990, width: 10, height: 30 }))
  expect(assertMode.popoverPosition.value.left).toBe(1000 - 320 - 16)
  expect(assertMode.popoverPosition.value.arrowLeft).toBe(320 - 28)
})

it('recalcula a posição quando a janela muda de tamanho', async () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 400, bottom: 430, left: 300, width: 100, height: 30 }))
  // O watch que instala o listener de resize só roda no tick seguinte.
  await nextTick()
  const antes = assertMode.popoverPosition.value.vertical

  vi.stubGlobal('innerHeight', 1200)
  window.dispatchEvent(new Event('resize'))

  expect(assertMode.popoverPosition.value.vertical).not.toBe(antes)
})

/** Onde a pill começa, contando a folga: 24px do rodapé, 44px de altura e 12px de respiro. */
const PILL_TOP = 800 - 80

it('não cobre a pill quando abre embaixo de um elemento no meio da tela', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 300, bottom: 330, left: 300, width: 100, height: 30 }))
  assertMode.setPopoverHeight(420)

  expect(span(420).bottom).toBeLessThanOrEqual(PILL_TOP)
})

/** Onde o balão começa e termina na tela, com a altura que ele consegue ocupar de fato. */
function span(height: number, viewportHeight = 800) {
  const { above, vertical, maxHeight } = useAssertMode().popoverPosition.value
  const shown = Math.min(height, maxHeight)
  const top = above ? viewportHeight - vertical - shown : vertical

  return { top, bottom: top + shown }
}

it('encolhe o balão em vez de cobrir o elemento quando ele não cabe em nenhum lado', () => {
  vi.stubGlobal('innerHeight', 500)
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 300, bottom: 335, left: 300, width: 100, height: 35 }))
  assertMode.setPopoverHeight(302)

  expect(span(302, 500).top).toBeGreaterThanOrEqual(16)
  expect(span(302, 500).bottom).toBeLessThanOrEqual(300)
  expect(assertMode.popoverPosition.value.maxHeight).toBeLessThan(302)
})

it('abre embaixo quando a altura real do balão não cabe em cima', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 250, bottom: 280, left: 300, width: 100, height: 30 }))
  assertMode.setPopoverHeight(380)

  expect(assertMode.popoverPosition.value.above).toBe(false)
  expect(span(380).top).toBeGreaterThanOrEqual(280)
})

it('mantém o balão inteiro dentro da tela quando ele não cabe em nenhum lado', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 350, bottom: 380, left: 300, width: 100, height: 30 }))
  assertMode.setPopoverHeight(500)

  expect(span(500).top).toBeGreaterThanOrEqual(16)
  expect(span(500).bottom).toBeLessThanOrEqual(PILL_TOP)
})

it('limita o balão à altura da janela quando ele é maior que ela', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 350, bottom: 380, left: 300, width: 100, height: 30 }))
  assertMode.setPopoverHeight(900)

  expect(assertMode.popoverPosition.value.maxHeight).toBeLessThanOrEqual(PILL_TOP - 16)
  expect(span(900).top).toBeGreaterThanOrEqual(16)
  expect(span(900).bottom).toBeLessThanOrEqual(PILL_TOP)
})

it('não empurra o balão para fora quando o elemento rolou para baixo da tela', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: 900, bottom: 930, left: 300, width: 100, height: 30 }))
  assertMode.setPopoverHeight(300)

  expect(span(300).top).toBeGreaterThanOrEqual(16)
  expect(span(300).bottom).toBeLessThanOrEqual(PILL_TOP)
})

it('não empurra o balão para fora quando o elemento rolou para cima da tela', () => {
  const assertMode = useAssertMode()

  assertMode.handleElementClick(element({ top: -400, bottom: -370, left: 300, width: 100, height: 30 }))
  assertMode.setPopoverHeight(300)

  expect(span(300).top).toBeGreaterThanOrEqual(16)
  expect(span(300).bottom).toBeLessThanOrEqual(PILL_TOP)
})

it('recalcula a posição quando a página rola com o balão aberto', async () => {
  const assertMode = useAssertMode()
  const el = element({ top: 400, bottom: 430, left: 300, width: 100, height: 30 })

  assertMode.handleElementClick(el)
  await nextTick()
  const antes = assertMode.popoverPosition.value.vertical

  el.getBoundingClientRect = () => ({ top: 200, bottom: 230, left: 300, width: 100, height: 30 }) as DOMRect
  window.dispatchEvent(new Event('scroll'))

  expect(assertMode.popoverPosition.value.vertical).not.toBe(antes)
})

it('grava a conferência escolhida, mesmo com a gravação pausada', async () => {
  const assertMode = useAssertMode()
  const enviados = captured()

  assertMode.handleElementClick(element({ top: 400, bottom: 430, left: 300, width: 100, height: 30 }))
  assertMode.confirmAssert('text', 'Bem-vindo')
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(enviados.at(-1)).toMatchObject({
    type: 'assert',
    assert: { assertType: 'text', expectedValue: 'Bem-vindo' }
  })
  expect(assertMode.isPopoverVisible.value).toBe(false)
})

it('não grava conferência sem elemento escolhido', async () => {
  const assertMode = useAssertMode()

  assertMode.deactivateAssertMode()
  const enviados = captured()

  assertMode.confirmAssert('visible', null)
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(enviados).toEqual([])
})

it('grava o assert de URL sem escolher elemento', async () => {
  const assertMode = useAssertMode()
  const enviados = captured()

  history.pushState({}, '', '/checkout')
  assertMode.assertUrl()
  await new Promise(resolve => setTimeout(resolve, 0))

  expect(enviados.at(-1)).toMatchObject({
    type: 'assert',
    selectors: null,
    label: null,
    assert: { assertType: 'url', expectedValue: window.location.href }
  })
})
