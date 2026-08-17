/**
 * A pill montada na página: o que ela grava a partir dos eventos reais do documento. O host é
 * único por módulo, então o caso do iframe vem antes de qualquer montagem.
 */
import { beforeEach, expect, it } from 'vitest'
import { nextTick } from 'vue'
import type { RecordingEvent } from '@/common/types/recording'
import { mountRecorder } from '../recorderCore'
import { usePillState } from '../usePillState'
import { useAssertMode } from '../useAssertMode'

let enviados: RecordingEvent[] = []

function host(): HTMLElement | null {
    return document.querySelector('#__acutis_host')
}

function page(html: string): void {
    document.body.innerHTML = `<div id="pagina">${html}</div>`
    const pagina = document.querySelector('#pagina')!

    if (host()) document.body.appendChild(host()!)

    return void pagina
}

function types(): string[] {
    return enviados.map((event) => event.type)
}

async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0))
}

beforeEach(() => {
    enviados = []
    window.__acutisReportEvent = (event) => { enviados.push(event as RecordingEvent) }
})

it('não monta a pill dentro de um iframe de terceiro', () => {
    Object.defineProperty(window, 'top', { value: {}, configurable: true })

    try {
        mountRecorder()

        expect(host()).toBeNull()
    } finally {
        Object.defineProperty(window, 'top', { value: window, configurable: true })
    }
})

it('monta a pill e grava a página onde a gravação começou', async () => {
    mountRecorder()
    await flush()

    expect(host()).not.toBeNull()
    expect(host()!.style.position).toBe('fixed')
    expect(types()).toEqual(['navigate'])
})

it('remonta o host que a página tirou do ar, sem duplicar', async () => {
    mountRecorder()
    const antes = host()

    antes!.remove()
    mountRecorder()

    expect(host()).toBe(antes)
    expect(document.querySelectorAll('#__acutis_host')).toHaveLength(1)
})

it('grava o clique num elemento interativo, e ignora o resto da página', async () => {
    mountRecorder()
    page('<button id="entrar">Entrar</button><span id="texto">Só texto</span>')

    document.querySelector<HTMLElement>('#texto')!.click()
    document.querySelector<HTMLElement>('#entrar')!.click()
    await flush()

    expect(types()).toEqual(['click'])
    expect(enviados[0]!.selectors?.id).toBe('entrar')
})

it('grava o clique em quem tem papel de botão', async () => {
    mountRecorder()
    page('<div id="acao" role="button">Ação</div>')

    document.querySelector<HTMLElement>('#acao')!.click()
    await flush()

    expect(types()).toEqual(['click'])
})

it('grava o clique no filho de um link', async () => {
    mountRecorder()
    page('<a href="/x"><span id="dentro">Ir</span></a>')

    document.querySelector<HTMLElement>('#dentro')!.click()
    await flush()

    expect(types()).toEqual(['click'])
})

it('ignora o campo escondido', async () => {
    mountRecorder()
    page('<input id="token" type="hidden" value="x" />')

    document.querySelector<HTMLElement>('#token')!.click()
    await flush()

    expect(types()).toEqual([])
})

it('mascara a senha na gravação de cenário', async () => {
    mountRecorder()
    page('<input id="senha" type="password" /><input id="email" />')
    const senha = document.querySelector<HTMLInputElement>('#senha')!
    const email = document.querySelector<HTMLInputElement>('#email')!

    senha.value = 'segredo'
    senha.dispatchEvent(new Event('change', { bubbles: true }))
    email.value = 'ana@loja.test'
    email.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()

    expect(enviados.map((event) => event.value)).toEqual(['••••', 'ana@loja.test'])
})

it('deixa a senha real passar na gravação de autenticação', async () => {
    ;(window as unknown as { __acutisRecorderMode?: string }).__acutisRecorderMode = 'auth'
    mountRecorder()
    page('<input id="senha-auth" type="password" />')
    const senha = document.querySelector<HTMLInputElement>('#senha-auth')!

    senha.value = 'segredo-real'
    senha.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()

    delete (window as unknown as { __acutisRecorderMode?: string }).__acutisRecorderMode

    expect(enviados[0]!.value).toBe('segredo-real')
})

it('não grava campo vazio nem elemento que não é campo', async () => {
    mountRecorder()
    page('<input id="vazio" /><div id="nao-campo"></div>')

    document.querySelector<HTMLInputElement>('#vazio')!.dispatchEvent(new Event('change', { bubbles: true }))
    document.querySelector<HTMLElement>('#nao-campo')!.dispatchEvent(new Event('change', { bubbles: true }))
    await flush()

    expect(types()).toEqual([])
})

it('grava o envio do formulário', async () => {
    mountRecorder()
    page('<form id="form"><button>Enviar</button></form>')

    document.querySelector<HTMLFormElement>('#form')!.dispatchEvent(new Event('submit', { bubbles: true }))
    await flush()

    expect(types()).toEqual(['submit'])
})

it('não grava nada com a gravação pausada', async () => {
    mountRecorder()
    page('<form id="pausado"><input id="campo" /><button id="ok">Ok</button></form>')
    const { togglePause } = usePillState()

    togglePause()
    document.querySelector<HTMLElement>('#ok')!.click()
    const campo = document.querySelector<HTMLInputElement>('#campo')!

    campo.value = 'ana'
    campo.dispatchEvent(new Event('change', { bubbles: true }))
    document.querySelector<HTMLFormElement>('#pausado')!.dispatchEvent(new Event('submit', { bubbles: true }))
    history.pushState({}, '', '/pausado')
    await flush()
    togglePause()

    expect(types()).toEqual([])
})

it('grava a navegação da SPA', async () => {
    mountRecorder()
    history.pushState({}, '', '/depois-da-pill')
    await flush()

    expect(types()).toEqual(['navigate'])
})

it('no modo conferência o clique escolhe o elemento em vez de virar evento', async () => {
    mountRecorder()
    page('<button id="titulo">Bem-vindo</button>')
    const assertMode = useAssertMode()
    const { captureMode } = usePillState()

    assertMode.activateAssertMode()
    await nextTick()
    document.querySelector<HTMLElement>('#titulo')!.click()
    await flush()

    expect(types()).toEqual([])
    expect(captureMode.value).toBeNull()
    expect(assertMode.pendingElement.value).toBe(document.querySelector('#titulo'))

    assertMode.deactivateAssertMode()
})

it('no modo hover o clique grava a passagem do mouse', async () => {
    mountRecorder()
    page('<button id="menu">Menu</button>')
    const { setCaptureMode, captureMode } = usePillState()

    setCaptureMode('hover')
    await nextTick()
    document.querySelector<HTMLElement>('#menu')!.click()
    await flush()

    expect(types()).toEqual(['hover'])
    expect(captureMode.value).toBeNull()
})

