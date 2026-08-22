// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { usePillState } from '../usePillState'

afterEach(() => {
  vi.useRealTimers()
})

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

  it('confirma a ação no botão e devolve o ícone dele depois', async () => {
    vi.useFakeTimers()
    const { confirmedAction, confirmAction } = usePillState()

    confirmAction('url')
    expect(confirmedAction.value).toBe('url')

    await vi.advanceTimersByTimeAsync(700)
    expect(confirmedAction.value).toBeNull()
  })

  it('a confirmação seguinte reinicia a contagem, e não deixa a anterior apagar o check', async () => {
    vi.useFakeTimers()
    const { confirmedAction, confirmAction } = usePillState()

    confirmAction('assert')
    await vi.advanceTimersByTimeAsync(600)
    confirmAction('hover')
    await vi.advanceTimersByTimeAsync(200)

    expect(confirmedAction.value).toBe('hover')
  })

  it('shares state across calls (singleton)', () => {
    const a = usePillState()
    const b = usePillState()
    a.setCaptureMode('hover')
    expect(b.captureMode.value).toBe('hover')
  })
})
