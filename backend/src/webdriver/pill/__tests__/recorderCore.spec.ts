import { describe, expect, it } from 'vitest'
import { isTopFrame, shouldMaskPasswords, watchNavigation } from '../recorderCore'

describe('isTopFrame', () => {
    it('records the page the user is on', () => {
        expect(isTopFrame()).toBe(true)
    })

    /**
     * Pixel de rede social, service worker de tag manager e reCAPTCHA são iframes que navegam
     * sozinhos. Gravar a URL deles enche a gravação de telas que o usuário nunca viu.
     */
    it('stays out of an iframe, where only third party scripts live', () => {
        Object.defineProperty(window, 'top', { value: {}, configurable: true })

        try {
            expect(isTopFrame()).toBe(false)
        } finally {
            Object.defineProperty(window, 'top', { value: window, configurable: true })
        }
    })
})

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

describe('watchNavigation', () => {
    it('reports every way a SPA changes the url, not only pushState', () => {
        const seen: string[] = []
        const stop = watchNavigation(() => seen.push(location.pathname + location.hash))

        history.pushState({}, '', '/dashboard')
        history.replaceState({}, '', '/dashboard/1')
        window.dispatchEvent(new PopStateEvent('popstate'))
        window.dispatchEvent(new HashChangeEvent('hashchange'))
        stop()

        expect(seen).toEqual(['/dashboard', '/dashboard/1', '/dashboard/1', '/dashboard/1'])
    })

    it('keeps the original history behaviour and stops reporting after unwatch', () => {
        const seen: string[] = []
        const stop = watchNavigation(() => seen.push(location.pathname))

        stop()
        history.pushState({}, '', '/depois')
        window.dispatchEvent(new PopStateEvent('popstate'))

        expect(seen).toEqual([])
        expect(location.pathname).toBe('/depois')
    })
})
