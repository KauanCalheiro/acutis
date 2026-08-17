import { describe, expect, it, vi } from 'vitest'
import { requestStop } from '../transport'
import type { RecordingEvent } from '@/common/types/recording'
import { useRecorderEvents } from '../useRecorderEvents'
import { usePillState } from '../usePillState'

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

/** Os eventos que chegaram ao gravador durante o caso. */
function captured(): RecordingEvent[] {
    const enviados: RecordingEvent[] = []

    window.__acutisReportEvent = (event) => { enviados.push(event as RecordingEvent) }

    return enviados
}

async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('useRecorderEvents: o que não vale reenviar', () => {
    const { dispatch, buildBaseEvent, buildNavigateEvent } = useRecorderEvents()
    const { togglePause, isPaused } = usePillState()

    it('descreve a navegação pela URL e pelo título da página', () => {
        document.title = 'Login'

        const event = buildNavigateEvent()

        expect(event).toMatchObject({ type: 'navigate', label: 'Login', selectors: null, html: null })
    })

    it('manda a mesma navegação uma vez só', async () => {
        const enviados = captured()

        dispatch({ ...buildNavigateEvent(), url: 'http://app.test/login' })
        dispatch({ ...buildNavigateEvent(), url: 'http://app.test/login' })
        dispatch({ ...buildNavigateEvent(), url: 'http://app.test/home' })
        await flush()

        expect(enviados.map((event) => event.url)).toEqual(['http://app.test/login', 'http://app.test/home'])
    })

    it('manda o mesmo preenchimento uma vez só', async () => {
        setBody('<input id="nome" />')
        const el = document.querySelector('input')!
        const enviados = captured()

        dispatch({ ...buildBaseEvent('fill', el), value: 'ana' })
        dispatch({ ...buildBaseEvent('fill', el), value: 'ana' })
        dispatch({ ...buildBaseEvent('fill', el), value: 'ana maria' })
        await flush()

        expect(enviados.map((event) => event.value)).toEqual(['ana', 'ana maria'])
    })

    it('ignora o clique repetido no mesmo elemento em menos de 250ms', async () => {
        setBody('<button id="entrar">Entrar</button>')
        const el = document.querySelector('button')!
        const enviados = captured()
        const base = buildBaseEvent('click', el)

        dispatch({ ...base, timestamp: 1000 })
        dispatch({ ...base, timestamp: 1100 })
        dispatch({ ...base, timestamp: 1400 })
        await flush()

        expect(enviados.map((event) => event.timestamp)).toEqual([1000, 1400])
    })

    it('não grava nada com a gravação pausada, a não ser quem ignora a pausa', async () => {
        setBody('<button id="pausado">Pausado</button>')
        const el = document.querySelector('button')!
        const enviados = captured()

        togglePause()
        expect(isPaused.value).toBe(true)

        dispatch(buildBaseEvent('hover', el))
        dispatch(buildBaseEvent('assert', el), true)
        await flush()

        togglePause()

        expect(enviados.map((event) => event.type)).toEqual(['assert'])
    })
})

describe('useRecorderEvents: a fila de envio', () => {
    const { dispatch, buildBaseEvent } = useRecorderEvents()

    it('tenta de novo o evento que não conseguiu sair', async () => {
        vi.useFakeTimers()
        setBody('<button id="reenvio">Reenvio</button>')
        const el = document.querySelector('button')!
        const enviados: RecordingEvent[] = []
        let falhas = 2

        window.__acutisReportEvent = (event) => {
            if (falhas > 0) {
                falhas--
                throw new Error('gravador fora do ar')
            }

            enviados.push(event as RecordingEvent)
        }

        dispatch({ ...buildBaseEvent('click', el), timestamp: 5000 })
        await vi.advanceTimersByTimeAsync(0)
        expect(enviados).toEqual([])

        await vi.advanceTimersByTimeAsync(500)
        expect(enviados).toEqual([])

        await vi.advanceTimersByTimeAsync(500)
        expect(enviados).toHaveLength(1)

        vi.useRealTimers()
    })
})

describe('requestStop', () => {
    it('pede ao gravador para parar, e não quebra sem gravador', () => {
        let pedidos = 0

        window.__acutisRequestStop = () => { pedidos++ }
        requestStop()

        delete window.__acutisRequestStop
        requestStop()

        expect(pedidos).toBe(1)
    })
})

describe('useRecorderEvents: como o elemento é nomeado', () => {
    const { buildBaseEvent } = useRecorderEvents()

    it('prefere o aria-label', () => {
        setBody('<button aria-label="Fechar o menu">×</button>')

        expect(buildBaseEvent('click', document.querySelector('button')!).label).toBe('Fechar o menu')
    })

    it('cai no label que envolve o campo', () => {
        setBody('<label>Senha <input id="senha" /></label>')

        expect(buildBaseEvent('fill', document.querySelector('input')!).label).toBe('Senha')
    })

    it('cai no label apontado por for', () => {
        setBody('<label for="email">E-mail</label><input id="email" />')

        expect(buildBaseEvent('fill', document.querySelector('input')!).label).toBe('E-mail')
    })

    it('cai no próprio texto quando não há label nenhum', () => {
        setBody('<button>Entrar agora</button>')
        const el = document.querySelector('button')!

        // O jsdom não calcula innerText, então o teste dita o que a tela mostraria.
        Object.defineProperty(el, 'innerText', { value: ' Entrar agora ', configurable: true })

        expect(buildBaseEvent('click', el).label).toBe('Entrar agora')
    })

    it('fica sem nome quando o elemento não diz nada', () => {
        setBody('<div id="vazio"></div>')

        expect(buildBaseEvent('click', document.querySelector('div')!).label).toBeNull()
    })
})
