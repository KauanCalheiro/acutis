import { describe, expect, it } from 'vitest'
import type { RecordingEvent } from '@/common/types/recording'
import { useRecorderEvents } from '../useRecorderEvents'

function setBody(html: string) {
    document.body.innerHTML = html
}

describe('useRecorderEvents', () => {
    const { buildBaseEvent, dispatch } = useRecorderEvents()

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

    /**
     * O clique dispara o hover do gatilho e o próprio clique na mesma volta do laço, e a fila
     * escoava duas vezes ao mesmo tempo: o segundo escoamento reenviava o evento que o primeiro
     * ainda não tinha tirado da fila.
     */
    it('sends each event once when two are queued in the same tick', async () => {
        setBody('<a id="ensino">Ensino</a><a id="curso">Curso</a>')
        const enviados: RecordingEvent[] = []
        window.__acutisReportEvent = (event) => { enviados.push(event as RecordingEvent) }

        dispatch(buildBaseEvent('hover', document.querySelector('#ensino')!))
        dispatch(buildBaseEvent('click', document.querySelector('#curso')!))

        await new Promise((resolve) => setTimeout(resolve, 0))

        expect(enviados.map((event) => event.selectors?.id)).toEqual(['ensino', 'curso'])
    })
})
