import { describe, expect, it, vi } from 'vitest'
import { createVideoCaptureCoordinator } from './videoCaptureCoordinator'

describe('createVideoCaptureCoordinator', () => {
    it('waits for offscreen readiness before starting capture', () => {
        const onSendStartCapture = vi.fn()
        const coordinator = createVideoCaptureCoordinator(onSendStartCapture)

        coordinator.startCapture('stream-1', 'session-1')
        expect(onSendStartCapture).not.toHaveBeenCalled()
        expect(coordinator.state).toBe('awaiting-offscreen')

        coordinator.markOffscreenReady()
        expect(onSendStartCapture).toHaveBeenCalledWith('stream-1', 'session-1')
        expect(coordinator.state).toBe('capturing')
    })

    it('starts immediately when the offscreen document is already ready (reused document)', () => {
        const onSendStartCapture = vi.fn()
        const coordinator = createVideoCaptureCoordinator(onSendStartCapture)

        coordinator.markOffscreenReady()

        coordinator.startCapture('stream-2', 'session-2')
        expect(onSendStartCapture).toHaveBeenCalledWith('stream-2', 'session-2')
        expect(coordinator.state).toBe('capturing')
    })

    it('ignores a stray offscreen-ready signal with nothing pending', () => {
        const onSendStartCapture = vi.fn()
        const coordinator = createVideoCaptureCoordinator(onSendStartCapture)

        coordinator.markOffscreenReady()
        expect(onSendStartCapture).not.toHaveBeenCalled()
        expect(coordinator.state).toBe('idle')
    })

    it('resets to idle and clears offscreen-ready state on video ready', () => {
        const onSendStartCapture = vi.fn()
        const coordinator = createVideoCaptureCoordinator(onSendStartCapture)

        coordinator.markOffscreenReady()
        coordinator.startCapture('stream-1', 'session-1')
        coordinator.markVideoReady()

        expect(coordinator.state).toBe('stopped')

        coordinator.startCapture('stream-2', 'session-2')
        expect(coordinator.state).toBe('awaiting-offscreen')
        expect(onSendStartCapture).toHaveBeenCalledTimes(1)
    })

    it('resets to stopped and clears offscreen-ready state on video failure', () => {
        const onSendStartCapture = vi.fn()
        const coordinator = createVideoCaptureCoordinator(onSendStartCapture)

        coordinator.markOffscreenReady()
        coordinator.startCapture('stream-1', 'session-1')
        coordinator.markVideoFailed()

        expect(coordinator.state).toBe('stopped')

        coordinator.startCapture('stream-2', 'session-2')
        expect(coordinator.state).toBe('awaiting-offscreen')
    })

    it('drops a pending start if reset before offscreen becomes ready', () => {
        const onSendStartCapture = vi.fn()
        const coordinator = createVideoCaptureCoordinator(onSendStartCapture)

        coordinator.startCapture('stream-1', 'session-1')
        coordinator.reset()
        coordinator.markOffscreenReady()

        expect(onSendStartCapture).not.toHaveBeenCalled()
        expect(coordinator.state).toBe('idle')
    })
})
