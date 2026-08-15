import { describe, expect, it } from 'vitest'
import { usePillState } from '../usePillState'

describe('usePillState', () => {
    it('toggles pause', () => {
        const { isPaused, togglePause } = usePillState()
        const initial = isPaused.value
        togglePause()
        expect(isPaused.value).toBe(!initial)
        togglePause()
        expect(isPaused.value).toBe(initial)
    })

    it('sets capture mode', () => {
        const { captureMode, setCaptureMode } = usePillState()
        setCaptureMode('assert')
        expect(captureMode.value).toBe('assert')
        setCaptureMode('hover')
        expect(captureMode.value).toBe('hover')
        setCaptureMode(null)
        expect(captureMode.value).toBeNull()
    })

    it('increments event count', () => {
        const { eventCount, incrementEventCount } = usePillState()
        const before = eventCount.value
        incrementEventCount()
        expect(eventCount.value).toBe(before + 1)
    })

    it('shares state across calls (singleton)', () => {
        const a = usePillState()
        const b = usePillState()
        a.setCaptureMode('hover')
        expect(b.captureMode.value).toBe('hover')
    })
})
