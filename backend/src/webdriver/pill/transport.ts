declare global {
    interface Window {
        __acutisReportEvent?: (event: unknown) => void
        __acutisRequestStop?: () => void
    }
}

export function reportEvent(event: unknown): Promise<void> {
    window.__acutisReportEvent?.(event)
    return Promise.resolve()
}

export function requestStop(): void {
    window.__acutisRequestStop?.()
}
