import { describe, expect, it } from 'vitest'
import { useSelectorCapture } from './useSelectorCapture'

function setBody(html: string) {
    document.body.innerHTML = html
}

describe('useSelectorCapture', () => {
    const { extractSelectors } = useSelectorCapture()

    it('prefers data-testid when unique', () => {
        setBody('<button data-testid="submit">Send</button>')
        const el = document.querySelector('button')!
        const selectors = extractSelectors(el)
        expect(selectors.dataTestId).toBe('submit')
    })

    it('ignores data-testid when duplicated on the page', () => {
        setBody('<button data-testid="dup">A</button><button data-testid="dup">B</button>')
        const el = document.querySelectorAll('button')[0]
        const selectors = extractSelectors(el)
        expect(selectors.dataTestId).toBeNull()
    })

    it('falls back to id-based css selector', () => {
        setBody('<input id="email" />')
        const el = document.querySelector('input')!
        const selectors = extractSelectors(el)
        expect(selectors.id).toBe('email')
        expect(selectors.cssStable).toBe('#email')
    })

    it('captures name, role, placeholder and trimmed text', () => {
        setBody('<input name="email" role="textbox" placeholder="you@example.com" />')
        const el = document.querySelector('input')!
        const selectors = extractSelectors(el)
        expect(selectors.name).toBe('email')
        expect(selectors.ariaRole).toBe('textbox')
        expect(selectors.placeholder).toBe('you@example.com')
    })

    it('builds a unique xpath as last resort', () => {
        setBody('<div><span>x</span><span>y</span></div>')
        const el = document.querySelectorAll('span')[1]
        const selectors = extractSelectors(el)
        expect(selectors.xpath).toBe('/html[1]/body[1]/div[1]/span[2]')
    })

    it('returns null for attributes that are absent', () => {
        setBody('<div>plain</div>')
        const el = document.querySelector('div')!
        const selectors = extractSelectors(el)
        expect(selectors.dataTestId).toBeNull()
        expect(selectors.dataCy).toBeNull()
        expect(selectors.ariaLabel).toBeNull()
        expect(selectors.id).toBeNull()
        expect(selectors.name).toBeNull()
    })
})
