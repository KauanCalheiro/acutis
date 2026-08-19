let overlay: HTMLDivElement | null = null
let hostElement: HTMLElement | null = null

export function useOverlay() {
  function setHostElement(el: HTMLElement) {
    hostElement = el
  }

  function createOverlay(color: string) {
    overlay = document.createElement('div')
    overlay.style.cssText = `position:fixed;pointer-events:none;z-index:2147483646;outline:2px solid ${color};outline-offset:2px;border-radius:3px;display:none;`
    document.body.appendChild(overlay)
  }

  function updateOverlay(el: Element) {
    if (!overlay) return
    const r = el.getBoundingClientRect()
    Object.assign(overlay.style, { top: r.top + 'px', left: r.left + 'px', width: r.width + 'px', height: r.height + 'px', display: 'block' })
  }

  function removeOverlay() {
    overlay?.remove()
    overlay = null
  }

  function onMouseMoveForCapture(e: MouseEvent) {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    if (el && el !== hostElement && !hostElement?.contains(el)) updateOverlay(el)
  }

  function activate(color: string) {
    document.body.style.cursor = 'crosshair'
    createOverlay(color)
    document.addEventListener('mousemove', onMouseMoveForCapture, true)
  }

  function deactivate() {
    document.body.style.cursor = ''
    removeOverlay()
    document.removeEventListener('mousemove', onMouseMoveForCapture, true)
  }

  return { setHostElement, activate, deactivate }
}
