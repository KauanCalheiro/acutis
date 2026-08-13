import { describe, expect, it } from 'vitest'
import { useRecorderEvents } from './useRecorderEvents'

function setBody(html: string) {
    document.body.innerHTML = html
}

describe('useRecorderEvents', () => {
    const { buildBaseEvent } = useRecorderEvents()

    it('records that a checkbox ended up checked', () => {
        setBody('<input type="checkbox" id="presente" checked />')
        const el = document.querySelector('input')!

        expect(buildBaseEvent('fill', el).checked).toBe(true)
    })

    it('records that a checkbox ended up unchecked', () => {
        setBody('<input type="checkbox" id="presente" />')
        const el = document.querySelector('input')!

        expect(buildBaseEvent('fill', el).checked).toBe(false)
    })

    it('leaves the checked state out for an element that has none', () => {
        setBody('<input type="text" id="nome" />')
        const el = document.querySelector('input')!

        expect(buildBaseEvent('fill', el).checked).toBeNull()
    })
})
