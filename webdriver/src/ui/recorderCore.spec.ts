import { describe, expect, it } from 'vitest'
import { resolveFillValue } from './recorderCore'

describe('resolveFillValue', () => {
    it('marks a password field as sensitive and keeps the real value', () => {
        document.body.innerHTML = '<input type="password" />'
        const el = document.querySelector('input')!
        el.value = 'hunter2'

        expect(resolveFillValue(el)).toEqual({ value: 'hunter2', sensitive: true })
    })

    it('does not mark a regular text field as sensitive', () => {
        document.body.innerHTML = '<input type="text" />'
        const el = document.querySelector('input')!
        el.value = 'someone@example.com'

        expect(resolveFillValue(el)).toEqual({ value: 'someone@example.com', sensitive: false })
    })

    it('does not mark a textarea as sensitive', () => {
        document.body.innerHTML = '<textarea></textarea>'
        const el = document.querySelector('textarea')!
        el.value = 'some notes'

        expect(resolveFillValue(el)).toEqual({ value: 'some notes', sensitive: false })
    })
})
