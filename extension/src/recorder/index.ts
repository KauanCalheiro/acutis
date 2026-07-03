import { createApp, watch } from 'vue'
import RecorderApp from './RecorderApp.vue'
import pillCss from './pill/pill.css?inline'
import { usePillState } from './pill/usePillState'
import { useOverlay } from './pill/useOverlay'
import { useRecorderEvents } from './pill/useRecorderEvents'
import { useAssertMode } from './pill/useAssertMode'
import { createVideoRecordingGate, startScreenCapture, stopScreenCapture } from './pill/useVideoRecording'

declare const self: Window & typeof globalThis & { __acutisRecorderLoaded?: boolean }

if (self.__acutisRecorderLoaded) {
  // idempotent: skip re-installing listener if script runs twice
} else {
  self.__acutisRecorderLoaded = true
  installListener()
}

let hostElement: HTMLDivElement | null = null
let keepAliveObserver: MutationObserver | null = null
let stopVideoCapture: (() => Promise<void>) | null = null

function ensureAttached(): void {
  if (!hostElement) return
  const parent = document.body ?? document.documentElement
  if (!parent) return
  if (hostElement.parentElement !== parent) parent.appendChild(hostElement)
}

function startRecorder(sessionId: string, frontendUrl: string): void {
  if (hostElement) {
    ensureAttached()
    return
  }

  const { captureMode, setCaptureMode, isPaused } = usePillState()
  const { setHostElement, activate, deactivate } = useOverlay()
  const { dispatch, buildBaseEvent, buildNavigateEvent } = useRecorderEvents()
  const { handleElementClick } = useAssertMode()

  let activeCapture: Awaited<ReturnType<typeof startScreenCapture>> | null = null
  const videoGate = createVideoRecordingGate(async () => {
    try {
      activeCapture = await startScreenCapture()
      chrome.runtime.sendMessage({ type: 'VIDEO_CAPTURE_STARTED', sessionId })
    } catch (e) {
      console.error('[acutis] startScreenCapture failed', e)
      chrome.runtime.sendMessage({ type: 'VIDEO_FAILED' })
    }
  })
  stopVideoCapture = async () => {
    if (!activeCapture) {
      chrome.runtime.sendMessage({ type: 'VIDEO_FAILED' })
      return
    }
    const uploaded = await stopScreenCapture(activeCapture, sessionId, frontendUrl)
    chrome.runtime.sendMessage({ type: uploaded ? 'VIDEO_READY' : 'VIDEO_FAILED', sessionId })
  }

  hostElement = document.createElement('div')
  hostElement.id = '__acutis_host'
  Object.assign(hostElement.style, {
    position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
    zIndex: '2147483647', pointerEvents: 'none', overflow: 'visible',
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

  keepAliveObserver = new MutationObserver(() => ensureAttached())
  keepAliveObserver.observe(document.documentElement, { childList: true, subtree: true })

  watch(captureMode, (mode) => {
    if (mode === 'assert' || mode === 'hover') {
      activate(mode === 'assert' ? '#FF4444' : '#4488FF')
    } else {
      deactivate()
    }
  })

  function isHostEvent(e: Event): boolean { return e.target === hostElement }

  function isInteractive(el: Element): boolean {
    if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el instanceof HTMLSelectElement) return true
    if (el instanceof HTMLInputElement) return !['hidden'].includes(el.type)
    if (el instanceof HTMLTextAreaElement || el instanceof HTMLLabelElement) return true
    if (el.hasAttribute('role') || el.hasAttribute('onclick') || el.hasAttribute('tabindex')) return true
    return !!el.closest('button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [onclick]')
  }

  dispatch(buildNavigateEvent())

  document.addEventListener('click', (e) => {
    videoGate.handleClick()
    if (!(e.target instanceof Element) || isHostEvent(e)) return
    if (captureMode.value === 'assert') {
      e.stopPropagation(); e.preventDefault()
      setCaptureMode(null); handleElementClick(e.target); return
    }
    if (captureMode.value === 'hover') {
      e.stopPropagation(); e.preventDefault()
      dispatch({ ...buildBaseEvent('hover', e.target), value: null }); setCaptureMode(null); return
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
    const value = el instanceof HTMLInputElement && el.type === 'password' ? '••••' : raw
    dispatch({ ...buildBaseEvent('fill', el), value })
  }, true)

  document.addEventListener('submit', (e) => {
    if (!(e.target instanceof Element) || isHostEvent(e) || isPaused.value) return
    dispatch(buildBaseEvent('submit', e.target))
  }, true)

  const originalPushState = history.pushState.bind(history)
  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState(...args)
    if (!isPaused.value) dispatch(buildNavigateEvent())
  }

  window.addEventListener('popstate', () => {
    if (!isPaused.value) dispatch(buildNavigateEvent())
  })
}

function installListener(): void {
  chrome.runtime.onMessage.addListener((message: { type: string; sessionId?: string; frontendUrl?: string }) => {
    if (message.type === 'START' && message.sessionId && message.frontendUrl) {
      startRecorder(message.sessionId, message.frontendUrl)
    }
    if (message.type === 'STOP') {
      const stop = stopVideoCapture
      stopVideoCapture = null
      void Promise.resolve(stop?.()).finally(() => {
        chrome.runtime.sendMessage({ type: 'RECORDER_STOPPED' })
      })
      keepAliveObserver?.disconnect()
      keepAliveObserver = null
      hostElement?.remove()
      hostElement = null
    }
  })

  chrome.runtime.sendMessage(
    { type: 'RECORDER_QUERY_ACTIVE' },
    (response: { active?: boolean; sessionId?: string; frontendUrl?: string } | undefined) => {
      if (response?.active && response.sessionId && response.frontendUrl) {
        startRecorder(response.sessionId, response.frontendUrl)
      }
    },
  )
}
