import { describe, expect, it, vi } from 'vitest'
import { createVideoRecordingGate } from './useVideoRecording'

describe('createVideoRecordingGate', () => {
    it('starts capture on the first click only', async () => {
        const startCapture = vi.fn().mockResolvedValue(undefined)
        const gate = createVideoRecordingGate(startCapture)

        gate.handleClick()
        gate.handleClick()
        gate.handleClick()

        expect(startCapture).toHaveBeenCalledTimes(1)
    })

    it('does not start capture again after a stop and reset', () => {
        const startCapture = vi.fn().mockResolvedValue(undefined)
        const gate = createVideoRecordingGate(startCapture)

        gate.handleClick()
        gate.reset()
        gate.handleClick()

        expect(startCapture).toHaveBeenCalledTimes(2)
    })

    it('reports capture as not started when no click ever happened', () => {
        const startCapture = vi.fn().mockResolvedValue(undefined)
        const gate = createVideoRecordingGate(startCapture)

        expect(gate.started).toBe(false)
    })

    it('reports capture as started once the first click fires it', () => {
        const startCapture = vi.fn().mockResolvedValue(undefined)
        const gate = createVideoRecordingGate(startCapture)

        gate.handleClick()

        expect(gate.started).toBe(true)
    })
})
