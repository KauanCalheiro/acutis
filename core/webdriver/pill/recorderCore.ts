import { createApp, watch } from 'vue'
import RecorderApp from './RecorderApp.vue'
import pillCss from './pill.css?inline'
import { usePillState } from './usePillState'
import { useOverlay } from './useOverlay'
import { useRecorderEvents } from './useRecorderEvents'
import { useAssertMode } from './useAssertMode'

let hostElement: HTMLDivElement | null = null
let keepAliveObserver: MutationObserver | null = null

/** Se este frame é a página onde o usuário está, e não um iframe de terceiro. */
export function isTopFrame(): boolean {
  try {
    return window.top === window
  } catch {
    return false
  }
}

/** Se a senha é mascarada antes de sair do navegador; só a gravação de auth a deixa passar. */
export function shouldMaskPasswords(): boolean {
  return (window as unknown as { __acutisRecorderMode?: string }).__acutisRecorderMode !== 'auth'
}

/**
 * Chama de volta em toda mudança de URL — pushState, replaceState, histórico e hash. Devolve o
 * desfazer.
 */
export function watchNavigation(onNavigate: () => void): () => void {
  const original = { pushState: history.pushState, replaceState: history.replaceState }

  for (const method of ['pushState', 'replaceState'] as const) {
    history[method] = function (...args: Parameters<History['pushState']>) {
      original[method].apply(history, args)
      onNavigate()
    }
  }

  window.addEventListener('popstate', onNavigate)
  window.addEventListener('hashchange', onNavigate)

  return () => {
    Object.assign(history, original)
    window.removeEventListener('popstate', onNavigate)
    window.removeEventListener('hashchange', onNavigate)
  }
}

function ensureAttached(): void {
  if (!hostElement || typeof document === 'undefined') return
  const parent = document.body ?? document.documentElement
  if (!parent) return
  if (hostElement.parentElement === parent) return

  parent.appendChild(hostElement)
  promoteToTopLayer(hostElement)
}

type PopoverHost = HTMLElement & { showPopover?: () => void, hidePopover?: () => void }

/** Promove o host ao top layer via Popover API; sem suporte, mantém só o z-index de hoje. */
function promoteToTopLayer(host: HTMLElement): void {
  const popoverHost = host as PopoverHost
  if (typeof popoverHost.showPopover !== 'function') return

  host.setAttribute('popover', 'manual')
  try {
    popoverHost.showPopover()
  } catch {
    host.removeAttribute('popover')
  }
}

/** Recoloca o host no topo da pilha do top layer, acima de um modal aberto depois dele. */
function repromoteHost(): void {
  if (!hostElement || !hostElement.hasAttribute('popover')) return
  const popoverHost = hostElement as PopoverHost
  try {
    popoverHost.hidePopover?.()
    popoverHost.showPopover?.()
  } catch {
    hostElement.removeAttribute('popover')
  }
}

const MODAL_SELECTOR = 'dialog[open], [popover]'

/** Se alguma mutação da leva indica modal novo, abrindo por atributo ou entrando pronto no DOM. */
function opensModalContent(mutations: MutationRecord[]): boolean {
  return mutations.some((mutation) => {
    if (mutation.type === 'attributes') {
      const target = mutation.target

      if (!(target instanceof Element) || target === hostElement) return false

      return mutation.attributeName === 'popover' || target.matches('dialog')
    }

    return [...mutation.addedNodes].some(node =>
      node instanceof Element
      && node !== hostElement
      && (node.matches(MODAL_SELECTOR) || node.querySelector(MODAL_SELECTOR) !== null)
    )
  })
}

export function mountRecorder(onClick?: () => void): void {
  if (!isTopFrame()) {
    return
  }

  if (hostElement) {
    ensureAttached()
    return
  }

  if (!document.documentElement) {
    document.addEventListener('DOMContentLoaded', () => mountRecorder(onClick), { once: true })
    return
  }

  const { captureMode, setCaptureMode, isPaused, confirmAction } = usePillState()
  const { setHostElement, activate, deactivate } = useOverlay()
  const { dispatch, buildBaseEvent, buildNavigateEvent } = useRecorderEvents()
  const { handleElementClick } = useAssertMode()

  hostElement = document.createElement('div')
  hostElement.id = '__acutis_host'
  Object.assign(hostElement.style, {
    position: 'fixed', top: '0', right: '0', bottom: '0', left: '0',
    width: '100%', height: '100%', maxWidth: 'none', maxHeight: 'none',
    margin: '0', border: 'none', padding: '0', background: 'transparent', color: 'inherit',
    zIndex: '2147483647', pointerEvents: 'none', overflow: 'visible'
  })
  setHostElement(hostElement)

  const shadow = hostElement.attachShadow({ mode: 'closed' })
  const styleEl = document.createElement('style')
  styleEl.textContent = pillCss
  shadow.appendChild(styleEl)
  const mountPoint = document.createElement('div')
  shadow.appendChild(mountPoint)

  const mountApp = () => ensureAttached()
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountApp)
  } else {
    mountApp()
  }

  createApp(RecorderApp).mount(mountPoint)

  document.addEventListener('beforetoggle', (event) => {
    if (event.target !== hostElement) repromoteHost()
  }, true)

  keepAliveObserver = new MutationObserver((mutations) => {
    ensureAttached()
    if (opensModalContent(mutations)) repromoteHost()
  })
  keepAliveObserver.observe(document.documentElement, {
    childList: true, subtree: true, attributes: true, attributeFilter: ['open', 'popover']
  })

  watch(captureMode, (mode) => {
    if (mode === 'assert' || mode === 'hover') {
      activate(mode === 'assert' ? '#FF4444' : '#4488FF')
    } else {
      deactivate()
    }
  })

  function isHostEvent(e: Event): boolean {
    return e.target === hostElement
  }

  function isInteractive(el: Element): boolean {
    if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el instanceof HTMLSelectElement) return true
    if (el instanceof HTMLInputElement) return !['hidden'].includes(el.type)
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLLabelElement) return true
    if (el.hasAttribute('role') || el.hasAttribute('onclick') || el.hasAttribute('tabindex')) return true
    return !!el.closest('button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [onclick]')
  }

  dispatch(buildNavigateEvent())

  document.addEventListener('click', (e) => {
    onClick?.()
    if (!(e.target instanceof Element) || isHostEvent(e)) return
    if (captureMode.value === 'assert') {
      e.stopPropagation()
      e.preventDefault()
      setCaptureMode(null)
      handleElementClick(e.target)
      return
    }
    if (captureMode.value === 'hover') {
      e.stopPropagation()
      e.preventDefault()
      dispatch({ ...buildBaseEvent('hover', e.target), value: null })
      confirmAction('hover')
      setCaptureMode(null)
      return
    }
    if (isPaused.value) return
    if (!isInteractive(e.target)) return

    dispatch(buildBaseEvent('click', e.target))
  }, true)

  document.addEventListener('change', (e) => {
    if (isHostEvent(e) || isPaused.value) return
    const el = e.target
    if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return
    const raw = (el as HTMLInputElement).value
    if (!raw) return
    const isPassword = el instanceof HTMLInputElement && el.type === 'password'
    const value = isPassword && shouldMaskPasswords() ? '••••' : raw
    dispatch({ ...buildBaseEvent('fill', el), value })
  }, true)

  document.addEventListener('submit', (e) => {
    if (!(e.target instanceof Element) || isHostEvent(e) || isPaused.value) return
    dispatch(buildBaseEvent('submit', e.target))
  }, true)

  watchNavigation(() => {
    if (!isPaused.value) dispatch(buildNavigateEvent())
  })
}
