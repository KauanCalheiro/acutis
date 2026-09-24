// @vitest-environment jsdom
/** O balão de conferência montado: o tamanho que ele mede e o limite que ele respeita. */
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import AssertPopover from '../AssertPopover.vue'
import { useAssertMode } from '../useAssertMode'

const RENDERED_HEIGHT = 480

/** Espera o balão abrir, medir a própria altura e repintar com a posição nova. */
async function settle(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}

function target(): Element {
  document.body.innerHTML = '<button id="alvo">Entrar</button>'
  const el = document.querySelector('button')!

  el.getBoundingClientRect = () => ({ top: 300, bottom: 330, left: 300, width: 100, height: 30 }) as DOMRect

  return el
}

beforeEach(() => {
  vi.stubGlobal('innerWidth', 1000)
  vi.stubGlobal('innerHeight', 800)
  vi.spyOn(HTMLElement.prototype, 'scrollHeight', 'get').mockReturnValue(RENDERED_HEIGHT)
})

afterEach(() => {
  useAssertMode().deactivateAssertMode()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

it('posiciona o balão pela altura que ele renderizou, e não por uma estimativa', async () => {
  const assertMode = useAssertMode()
  mount(AssertPopover)

  assertMode.handleElementClick(target())
  await settle()

  const { above, vertical, maxHeight } = assertMode.popoverPosition.value
  const shown = Math.min(RENDERED_HEIGHT, maxHeight)
  const top = above ? 800 - vertical - shown : vertical

  expect(top).toBeGreaterThanOrEqual(16)
  expect(top + shown).toBeLessThanOrEqual(800 - 80)
})

it('limita a altura do balão ao espaço que sobra junto ao elemento', async () => {
  const assertMode = useAssertMode()
  const wrapper = mount(AssertPopover)

  assertMode.handleElementClick(target())
  await settle()

  expect(assertMode.popoverPosition.value.maxHeight).toBeLessThan(RENDERED_HEIGHT)
  expect(wrapper.get('.assert-popover').attributes('style'))
    .toContain(`max-height: ${assertMode.popoverPosition.value.maxHeight}px`)
})

it('encolhe só a lista de opções, e o cancelar e o confirmar continuam à vista', async () => {
  const assertMode = useAssertMode()
  const wrapper = mount(AssertPopover)

  assertMode.handleElementClick(target())
  await settle()

  const partes = wrapper.get('.assert-popover').element.children
  const ordem = Array.from(partes).map(parte => parte.className.split(' ')[0])

  expect(ordem).toEqual(['popover-arrow', 'popover-header', 'popover-options', 'popover-value-wrap', 'surface-actions'])
})

it('não corta a seta que aponta para o elemento', async () => {
  const assertMode = useAssertMode()
  const wrapper = mount(AssertPopover)

  assertMode.handleElementClick(target())
  await settle()

  expect(wrapper.get('.assert-popover').attributes('style') ?? '').not.toContain('overflow')
})
