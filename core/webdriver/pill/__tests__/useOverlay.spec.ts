// @vitest-environment jsdom
/** O contorno que segue o mouse enquanto a pill está capturando um elemento. */
import { afterEach, beforeEach, expect, it } from 'vitest'
import { useOverlay } from '../useOverlay.js'

function overlay(): HTMLElement | null {
  return document.body.querySelector('div:not([id])')
}

function moveTo(target: Element): void {
  document.elementFromPoint = () => target
  document.dispatchEvent(new MouseEvent('mousemove', { clientX: 10, clientY: 20 }))
}

beforeEach(() => {
  document.body.innerHTML = '<button id="alvo">Entrar</button><div id="pill"></div>'
})

afterEach(() => {
  useOverlay().deactivate()
})

it('desenha o contorno na cor pedida e põe a mira no cursor', () => {
  useOverlay().activate('red')

  expect(overlay()!.style.outline).toContain('red')
  expect(document.body.style.cursor).toBe('crosshair')
})

it('segue o elemento sob o mouse', () => {
  const alvo = document.querySelector('#alvo')!

  alvo.getBoundingClientRect = () => ({ top: 5, left: 7, width: 100, height: 30 }) as DOMRect
  useOverlay().activate('red')
  moveTo(alvo)

  expect(overlay()!.style.display).toBe('block')
  expect(overlay()!.style.top).toBe('5px')
  expect(overlay()!.style.width).toBe('100px')
})

it('não contorna a própria pill', () => {
  const pill = document.querySelector<HTMLElement>('#pill')!
  const dentro = document.createElement('span')

  pill.appendChild(dentro)

  const capture = useOverlay()

  capture.setHostElement(pill)
  capture.activate('red')
  moveTo(pill)
  moveTo(dentro)

  expect(overlay()!.style.display).toBe('none')
})

it('tira o contorno e a mira ao desativar', () => {
  const capture = useOverlay()

  capture.activate('red')
  capture.deactivate()

  expect(overlay()).toBeNull()
  expect(document.body.style.cursor).toBe('')

  // Sem contorno na tela, o movimento do mouse não tem o que atualizar.
  moveTo(document.querySelector('#alvo')!)
  expect(overlay()).toBeNull()
})
