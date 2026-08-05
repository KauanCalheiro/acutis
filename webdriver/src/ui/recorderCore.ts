import { createApp, watch } from 'vue'
import RecorderApp from './RecorderApp.vue'
import pillCss from './pill/pill.css?inline'
import { usePillState } from './pill/usePillState'
import { useOverlay } from './pill/useOverlay'
import { useRecorderEvents } from './pill/useRecorderEvents'
import { useAssertMode } from './pill/useAssertMode'

let hostElement: HTMLDivElement | null = null
let keepAliveObserver: MutationObserver | null = null

/**
 * Por padrão a senha é sempre mascarada antes de sair do navegador, e só o modo 'auth'
 * (gravação específica pra configurar autenticação) desativa isso, pra extrair credenciais
 * reais no backend. Gravação de cenário normal nunca vê esse valor.
 */
export function shouldMaskPasswords(): boolean {
    return (window as unknown as { __acutisRecorderMode?: string }).__acutisRecorderMode !== 'auth'
}

/**
 * Chama de volta em toda mudança de URL feita pela aplicação. Roteador de SPA troca de tela por
 * pushState, replaceState (redirect/guard de rota), voltar/avançar do navegador ou só o hash —
 * escutar apenas pushState perde a maioria das navegações de plataforma. Devolve o desfazer.
 */
export function watchNavigation(onNavigate: () => void): () => void {
    const original = { pushState: history.pushState, replaceState: history.replaceState }

    for (const method of ['pushState', 'replaceState'] as const) {
        history[method] = function (...args: Parameters<History['pushState']>) {
            original[method].apply(history, args)
            onNavigate()
        }
    }

    window.addEventListener('popstate', onNavigate)
    window.addEventListener('hashchange', onNavigate)

    return () => {
        Object.assign(history, original)
        window.removeEventListener('popstate', onNavigate)
        window.removeEventListener('hashchange', onNavigate)
    }
}

function ensureAttached(): void {
    if (!hostElement) return
    const parent = document.body ?? document.documentElement
    if (!parent) return
    if (hostElement.parentElement !== parent) parent.appendChild(hostElement)
}

export function mountRecorder(onClick?: () => void): void {
    if (hostElement) {
        ensureAttached()
        return
    }

    if (!document.documentElement) {
        document.addEventListener('DOMContentLoaded', () => mountRecorder(onClick), { once: true })
        return
    }

    const { captureMode, setCaptureMode, isPaused } = usePillState()
    const { setHostElement, activate, deactivate } = useOverlay()
    const { dispatch, buildBaseEvent, buildNavigateEvent } = useRecorderEvents()
    const { handleElementClick } = useAssertMode()

    hostElement = document.createElement('div')
    hostElement.id = '__acutis_host'
    Object.assign(hostElement.style, {
        position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
        zIndex: '2147483647', pointerEvents: 'none', overflow: 'visible',
    })
    setHostElement(hostElement)

    const shadow = hostElement.attachShadow({ mode: 'closed' })
    const styleEl = document.createElement('style')
    styleEl.textContent = pillCss
    shadow.appendChild(styleEl)
    const mountPoint = document.createElement('div')
    shadow.appendChild(mountPoint)

    const mountApp = () => ensureAttached()
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mountApp)
    } else {
        mountApp()
    }

    createApp(RecorderApp).mount(mountPoint)

    keepAliveObserver = new MutationObserver(() => ensureAttached())
    keepAliveObserver.observe(document.documentElement, { childList: true, subtree: true })

    watch(captureMode, (mode) => {
        if (mode === 'assert' || mode === 'hover') {
            activate(mode === 'assert' ? '#FF4444' : '#4488FF')
        } else {
            deactivate()
        }
    })

    function isHostEvent(e: Event): boolean { return e.target === hostElement }

    function isInteractive(el: Element): boolean {
        if (el instanceof HTMLButtonElement || el instanceof HTMLAnchorElement || el instanceof HTMLSelectElement) return true
        if (el instanceof HTMLInputElement) return !['hidden'].includes(el.type)
        if (el instanceof HTMLTextAreaElement || el instanceof HTMLLabelElement) return true
        if (el.hasAttribute('role') || el.hasAttribute('onclick') || el.hasAttribute('tabindex')) return true
        return !!el.closest('button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], [onclick]')
    }

    dispatch(buildNavigateEvent())

    document.addEventListener('click', (e) => {
        onClick?.()
        if (!(e.target instanceof Element) || isHostEvent(e)) return
        if (captureMode.value === 'assert') {
            e.stopPropagation(); e.preventDefault()
            setCaptureMode(null); handleElementClick(e.target); return
        }
        if (captureMode.value === 'hover') {
            e.stopPropagation(); e.preventDefault()
            dispatch({ ...buildBaseEvent('hover', e.target), value: null }); setCaptureMode(null); return
        }
        if (isPaused.value) return
        if (!isInteractive(e.target)) return
        dispatch(buildBaseEvent('click', e.target))
    }, true)

    document.addEventListener('change', (e) => {
        if (isHostEvent(e) || isPaused.value) return
        const el = e.target
        if (!(el instanceof HTMLInputElement || el instanceof HTMLSelectElement || el instanceof HTMLTextAreaElement)) return
        const raw = (el as HTMLInputElement).value
        if (!raw) return
        const isPassword = el instanceof HTMLInputElement && el.type === 'password'
        const value = isPassword && shouldMaskPasswords() ? '••••' : raw
        dispatch({ ...buildBaseEvent('fill', el), value })
    }, true)

    document.addEventListener('submit', (e) => {
        if (!(e.target instanceof Element) || isHostEvent(e) || isPaused.value) return
        dispatch(buildBaseEvent('submit', e.target))
    }, true)

    watchNavigation(() => {
        if (!isPaused.value) dispatch(buildNavigateEvent())
    })
}

export function unmountRecorder(): void {
    keepAliveObserver?.disconnect()
    keepAliveObserver = null
    hostElement?.remove()
    hostElement = null
}
