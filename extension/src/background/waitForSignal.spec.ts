import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitForSignal } from './waitForSignal'

describe('waitForSignal', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('resolves as soon as a matching message arrives, before the timeout', async () => {
        let listener: ((msg: unknown) => void) | null = null
        const onMessage = vi.fn((l: (msg: unknown) => void) => { listener = l })
        const offMessage = vi.fn()

        const promise = waitForSignal(onMessage, offMessage, (msg) => (msg as { type: string }).type === 'DONE', 10_000)
        let resolved = false
        void promise.then(() => { resolved = true })

        listener!({ type: 'DONE' })
        await Promise.resolve()

        expect(resolved).toBe(true)
        expect(offMessage).toHaveBeenCalledTimes(1)
    })

    it('ignores non-matching messages', async () => {
        let listener: ((msg: unknown) => void) | null = null
        const onMessage = vi.fn((l: (msg: unknown) => void) => { listener = l })
        const offMessage = vi.fn()

        const promise = waitForSignal(onMessage, offMessage, (msg) => (msg as { type: string }).type === 'DONE', 10_000)
        let resolved = false
        void promise.then(() => { resolved = true })

        listener!({ type: 'SOMETHING_ELSE' })
        await Promise.resolve()

        expect(resolved).toBe(false)
    })

    it('resolves via timeout if no matching message ever arrives', async () => {
        const onMessage = vi.fn()
        const offMessage = vi.fn()

        const promise = waitForSignal(onMessage, offMessage, () => false, 5_000)
        let resolved = false
        void promise.then(() => { resolved = true })

        await vi.advanceTimersByTimeAsync(5_000)

        expect(resolved).toBe(true)
    })

    it('does not resolve twice when both a match and the timeout happen', async () => {
        let listener: ((msg: unknown) => void) | null = null
        const onMessage = vi.fn((l: (msg: unknown) => void) => { listener = l })
        const offMessage = vi.fn()

        const promise = waitForSignal(onMessage, offMessage, (msg) => (msg as { type: string }).type === 'DONE', 5_000)
        let resolveCount = 0
        void promise.then(() => { resolveCount++ })

        listener!({ type: 'DONE' })
        await Promise.resolve()
        await vi.advanceTimersByTimeAsync(5_000)

        expect(resolveCount).toBe(1)
    })
})
