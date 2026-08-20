import type { RecordingEvent, RecordingEventType } from '@/common/types/recording'
import { captureContext } from './htmlContext'
import { usePillState } from './usePillState'
import { useSelectorCapture } from './useSelectorCapture'
import { reportEvent } from './transport'

const { isPaused, incrementEventCount } = usePillState()
const { extractSelectors } = useSelectorCapture()

let lastNavigateUrl: string | null = null
let lastFillKey: string | null = null
let lastClickKey: string | null = null
let lastClickAt = 0

const pendingQueue: RecordingEvent[] = []
let drainTimer: number | null = null
let draining = false

function scheduleDrain(delay: number): void {
  if (drainTimer !== null) {
    return
  }

  drainTimer = window.setTimeout(() => {
    drainTimer = null
    void drainQueue()
  }, delay)
}

/**
 * Um escoamento por vez: o evento fica na fila até o envio voltar.
 */
async function drainQueue(): Promise<void> {
  if (draining) {
    return
  }

  draining = true

  try {
    while (pendingQueue.length > 0) {
      const event = pendingQueue[0]
      try {
        await reportEvent(event)
        pendingQueue.shift()
      } catch {
        scheduleDrain(500)
        return
      }
    }
  } finally {
    draining = false
  }
}

function sendEvent(event: RecordingEvent): void {
  pendingQueue.push(event)
  void drainQueue()
}

export function useRecorderEvents() {
  function dispatch(event: RecordingEvent, ignorePause = false) {
    if (!ignorePause && isPaused.value) {
      return
    }

    if (event.type === 'navigate') {
      if (event.url === lastNavigateUrl) {
        return
      }

      lastNavigateUrl = event.url
    }

    if (event.type === 'fill') {
      const key = `${event.selectors?.cssStable ?? event.selectors?.xpath ?? ''}::${event.value ?? ''}`
      if (key === lastFillKey) {
        return
      }

      lastFillKey = key
    }

    if (event.type === 'click') {
      const key = event.selectors?.xpath ?? event.selectors?.cssStable ?? event.selectors?.finder ?? ''
      if (key === lastClickKey && event.timestamp - lastClickAt < 250) {
        return
      }

      lastClickKey = key
      lastClickAt = event.timestamp
    }

    sendEvent(event)

    incrementEventCount()
  }

  function resolveLabel(el: Element): string | null {
    const ariaLabel = el.getAttribute('aria-label')

    if (ariaLabel) {
      return ariaLabel
    }

    const labelEl = el.closest('label') ?? (el.id ? document.querySelector<HTMLElement>(`label[for="${el.id}"]`) : null)

    if (labelEl) {
      return labelEl.textContent?.trim() || null
    }

    return (el as HTMLElement).innerText?.trim().slice(0, 200) || null
  }

  function buildBaseEvent(type: RecordingEventType, el: Element): RecordingEvent {
    return {
      type,
      timestamp: Date.now(),
      url: window.location.href,
      selectors: extractSelectors(el),
      label: resolveLabel(el),
      value: null,
      sensitive: false,
      tagName: el.tagName.toLowerCase(),
      innerText: (el as HTMLElement).innerText?.trim().slice(0, 200) || null,
      inputType: el instanceof HTMLInputElement ? el.type : null,
      checked: el instanceof HTMLInputElement && ['checkbox', 'radio'].includes(el.type) ? el.checked : null,
      html: captureContext(el)
    }
  }

  function buildNavigateEvent(): RecordingEvent {
    return {
      type: 'navigate',
      timestamp: Date.now(),
      url: window.location.href,
      selectors: null,
      label: document.title || null,
      value: null,
      sensitive: false,
      tagName: null,
      innerText: null,
      inputType: null,
      checked: null,
      html: null
    }
  }

  return {
    dispatch,
    buildBaseEvent,
    buildNavigateEvent
  }
}
