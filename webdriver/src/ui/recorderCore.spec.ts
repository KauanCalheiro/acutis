import { describe, expect, it } from 'vitest'
import { shouldMaskPasswords } from './recorderCore'

type RecorderWindow = { __acutisRecorderMode?: string }

describe('shouldMaskPasswords', () => {
    it('masks the password in a regular scenario recording', () => {
        delete (window as unknown as RecorderWindow).__acutisRecorderMode

        expect(shouldMaskPasswords()).toBe(true)
    })

    it('masks the password in any mode other than auth', () => {
        ;(window as unknown as RecorderWindow).__acutisRecorderMode = 'scenario'

        expect(shouldMaskPasswords()).toBe(true)
    })

    it('keeps the real password while recording an auth setup', () => {
        ;(window as unknown as RecorderWindow).__acutisRecorderMode = 'auth'

        expect(shouldMaskPasswords()).toBe(false)
    })
})
