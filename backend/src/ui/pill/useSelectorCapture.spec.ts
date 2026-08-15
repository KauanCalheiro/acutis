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

    it('captures the text when it identifies a single element on the page', () => {
        setBody('<div><p>/caminho/intranet</p></div><div><p>/caminho/outro</p></div>')
        const el = document.querySelectorAll('p')[0]
        expect(extractSelectors(el).text).toBe('/caminho/intranet')
    })

    it('ignores the text when another element on the page carries the same one', () => {
        setBody('<p>Salvar</p><button>Salvar</button>')
        const el = document.querySelector('button')!
        expect(extractSelectors(el).text).toBeNull()
    })

    it('keeps the text of the innermost element when its parent holds nothing else', () => {
        setBody('<div><p>Produto criado</p></div>')
        const el = document.querySelector('p')!
        expect(extractSelectors(el).text).toBe('Produto criado')
    })

    it('normalizes the whitespace of the captured text', () => {
        setBody('<button>  Enviar\n  agora </button>')
        const el = document.querySelector('button')!
        expect(extractSelectors(el).text).toBe('Enviar agora')
    })

    it('ignores an element with no text of its own', () => {
        setBody('<button>   </button>')
        const el = document.querySelector('button')!
        expect(extractSelectors(el).text).toBeNull()
    })

    it('ignores a text too long to hold as a selector', () => {
        setBody(`<p>${'palavra '.repeat(20)}</p>`)
        const el = document.querySelector('p')!
        expect(extractSelectors(el).text).toBeNull()
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
