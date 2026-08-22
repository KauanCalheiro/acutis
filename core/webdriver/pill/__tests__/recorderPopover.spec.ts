// @vitest-environment jsdom
/**
 * O host da pill promovido ao top layer via Popover API, para não sumir atrás de modal do site
 * testado. Cada teste reimporta o módulo, pois o host é singleton por módulo.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let calls: string[] = []

function host(): HTMLElement | null {
  return document.querySelector('#__acutis_host')
}

function stubPopoverApi(): void {
  ;(HTMLElement.prototype as unknown as { showPopover: () => void }).showPopover = function (this: HTMLElement) {
    calls.push(`show:${this.id}`)
  }
  ;(HTMLElement.prototype as unknown as { hidePopover: () => void }).hidePopover = function (this: HTMLElement) {
    calls.push(`hide:${this.id}`)
  }
}

function removePopoverApi(): void {
  delete (HTMLElement.prototype as unknown as { showPopover?: () => void }).showPopover
  delete (HTMLElement.prototype as unknown as { hidePopover?: () => void }).hidePopover
}

async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

const NativeMutationObserver = globalThis.MutationObserver
const nativeAddEventListener = document.addEventListener.bind(document)
let observers: MutationObserver[] = []
let listeners: Array<[string, EventListenerOrEventListenerObject]> = []

beforeEach(() => {
  calls = []
  observers = []
  listeners = []
  globalThis.MutationObserver = class extends NativeMutationObserver {
    constructor(callback: MutationCallback) {
      super(callback)
      observers.push(this)
    }
  }
  document.addEventListener = (type: string, listener: EventListenerOrEventListenerObject, options?: unknown) => {
    listeners.push([type, listener])
    nativeAddEventListener(type, listener, options as AddEventListenerOptions)
  }
  vi.resetModules()
  document.body.innerHTML = ''
})

afterEach(() => {
  observers.forEach(observer => observer.disconnect())
  listeners.forEach(([type, listener]) => document.removeEventListener(type, listener, true))
  document.addEventListener = nativeAddEventListener
  globalThis.MutationObserver = NativeMutationObserver
  removePopoverApi()
})

it('promove o host ao top layer no mount, marcado como popover manual', async () => {
  stubPopoverApi()
  const { mountRecorder } = await import('../recorderCore')

  mountRecorder()

  expect(host()!.getAttribute('popover')).toBe('manual')
  expect(calls).toEqual(['show:__acutis_host'])
})

it('sem Popover API disponível, o mount não lança e a pill segue no z-index', async () => {
  removePopoverApi()
  const { mountRecorder } = await import('../recorderCore')

  expect(() => mountRecorder()).not.toThrow()

  expect(host()).not.toBeNull()
  expect(host()!.hasAttribute('popover')).toBe(false)
  expect(host()!.style.zIndex).toBe('2147483647')
})

it('repromove o host quando o modal entra pronto no DOM, sem abrir por atributo', async () => {
  stubPopoverApi()
  const { mountRecorder } = await import('../recorderCore')

  mountRecorder()
  calls = []

  const wrapper = document.createElement('div')
  wrapper.innerHTML = '<dialog open><p>modal do site</p></dialog>'
  document.body.appendChild(wrapper)
  await flush()

  expect(calls).toEqual(['hide:__acutis_host', 'show:__acutis_host'])
})

it('repromove quando um popover que já estava na página abre, sem mudar atributo', async () => {
  stubPopoverApi()
  const { mountRecorder } = await import('../recorderCore')

  const doSite = document.createElement('div')
  doSite.setAttribute('popover', 'auto')
  document.body.appendChild(doSite)
  mountRecorder()
  calls = []

  doSite.dispatchEvent(new Event('beforetoggle', { bubbles: true }))

  expect(calls).toEqual(['hide:__acutis_host', 'show:__acutis_host'])
})

it('volta ao z-index quando o popover recolhido não consegue reaparecer', async () => {
  stubPopoverApi()
  const { mountRecorder } = await import('../recorderCore')

  mountRecorder()
  ;(HTMLElement.prototype as unknown as { showPopover: () => void }).showPopover = () => {
    throw new Error('bloqueado pela página')
  }

  const dialog = document.createElement('dialog')
  document.body.appendChild(dialog)
  dialog.setAttribute('open', '')
  await flush()

  expect(host()!.hasAttribute('popover')).toBe(false)
  expect(host()!.style.zIndex).toBe('2147483647')
})

it('não repromove por detalhe abrindo, que não vai para o top layer', async () => {
  stubPopoverApi()
  const { mountRecorder } = await import('../recorderCore')

  mountRecorder()
  const details = document.createElement('details')
  document.body.appendChild(details)
  await flush()
  calls = []

  details.setAttribute('open', '')
  await flush()

  expect(calls).toEqual([])
})

it('volta ao top layer quando a página arranca o host do documento', async () => {
  stubPopoverApi()
  const { mountRecorder } = await import('../recorderCore')

  mountRecorder()
  calls = []

  host()!.remove()
  await flush()

  expect(host()).not.toBeNull()
  expect(calls).toEqual(['show:__acutis_host'])
})

it('repromove o host quando a página abre um dialog modal depois da pill', async () => {
  stubPopoverApi()
  const { mountRecorder } = await import('../recorderCore')

  mountRecorder()
  calls = []

  const dialog = document.createElement('dialog')
  document.body.appendChild(dialog)
  dialog.setAttribute('open', '')
  await flush()

  expect(calls).toEqual(['hide:__acutis_host', 'show:__acutis_host'])
})
