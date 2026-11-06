declare global {
  interface Window {
    __acutisReportEvent?: (event: unknown) => void
    __acutisHoldClick?: (event: unknown) => void
    __acutisFlushEvents?: () => Promise<void>
    __acutisRequestStop?: () => void
    __acutisCancelRecording?: () => void
  }
}

export function reportEvent(event: unknown): Promise<void> {
  window.__acutisReportEvent?.(event)
  return Promise.resolve()
}

export function reportHeldClick(event: unknown): void {
  window.__acutisHoldClick?.(event)
}

export function requestStop(): void {
  window.__acutisRequestStop?.()
}

export function cancelRecording(): void {
  window.__acutisCancelRecording?.()
}
