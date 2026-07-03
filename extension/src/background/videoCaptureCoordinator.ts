export type VideoCaptureState = 'idle' | 'awaiting-offscreen' | 'capturing' | 'stopped'

export interface VideoCaptureCoordinator {
    readonly state: VideoCaptureState
    startCapture(streamId: string, sessionId: string): void
    markOffscreenReady(): void
    markVideoReady(): void
    markVideoFailed(): void
    reset(): void
}

export function createVideoCaptureCoordinator(
    onSendStartCapture: (streamId: string, sessionId: string) => void,
): VideoCaptureCoordinator {
    let state: VideoCaptureState = 'idle'
    let offscreenReady = false
    let pending: { streamId: string; sessionId: string } | null = null

    function flushIfReady(): void {
        if (!offscreenReady || !pending) return
        const { streamId, sessionId } = pending
        pending = null
        state = 'capturing'
        onSendStartCapture(streamId, sessionId)
    }

    return {
        get state() {
            return state
        },
        startCapture(streamId, sessionId) {
            pending = { streamId, sessionId }
            state = 'awaiting-offscreen'
            flushIfReady()
        },
        markOffscreenReady() {
            offscreenReady = true
            flushIfReady()
        },
        markVideoReady() {
            state = 'stopped'
            offscreenReady = false
            pending = null
        },
        markVideoFailed() {
            state = 'stopped'
            offscreenReady = false
            pending = null
        },
        reset() {
            state = 'idle'
            offscreenReady = false
            pending = null
        },
    }
}
