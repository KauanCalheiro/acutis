// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useSelectorCapture } from '../useSelectorCapture'

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

  it('aceita o data-testid quando o gêmeo está num modal fechado', () => {
    setBody('<dialog><button data-testid="calendar-event-save">salvar</button></dialog><dialog open><button data-testid="calendar-event-save">salvar</button></dialog>')
    const el = document.querySelectorAll('button')[1]!
    const selectors = extractSelectors(el)

    expect(selectors.dataTestId).toBe('calendar-event-save')
    expect(selectors.hiddenTwins).toBe(true)
  })

  it('não marca gêmeo escondido quando o data-testid já é único', () => {
    setBody('<button data-testid="submit">Send</button>')
    const el = document.querySelector('button')!

    expect(extractSelectors(el).hiddenTwins).toBe(false)
  })

  it('falls back to id-based css selector', () => {
    setBody('<input id="email" />')
    const el = document.querySelector('input')!
    const selectors = extractSelectors(el)
    expect(selectors.id).toBe('email')
    expect(selectors.cssStable).toBe('#email')
  })

  it('prefere o name ao id gerado pelo framework no css estável', () => {
    setBody('<input id="v-0-42" name="email" />')
    const el = document.querySelector('input')!

    expect(extractSelectors(el).cssStable).toBe('input[name="email"]')
  })

  it('escopa pelo ancestral semântico quando o name se repete na página', () => {
    setBody(`
      <form name="form_search"><input id="tentry_1" name="id" /></form>
      <form name="form_Cliente"><input id="tentry_2" name="id" /></form>
    `)
    const el = document.querySelectorAll('input')[1]!

    expect(extractSelectors(el).cssStable).toBe('form[name="form_Cliente"] input[name="id"]')
  })

  it('escopa pelo data-testid do ancestral quando ele existe', () => {
    setBody(`
      <div data-testid="painel-busca"><input id="tentry_1" name="id" /></div>
      <div data-testid="painel-edicao"><input id="tentry_2" name="id" /></div>
    `)
    const el = document.querySelectorAll('input')[1]!

    expect(extractSelectors(el).cssStable).toBe('[data-testid="painel-edicao"] input[name="id"]')
  })

  it('não escopa pelo ancestral cujo id o framework gera', () => {
    setBody(`
      <div id="wrap_1"><input name="id" /></div>
      <div id="wrap_2"><input name="id" /></div>
    `)
    const el = document.querySelectorAll('input')[1]!

    expect(extractSelectors(el).cssStable).toBeNull()
  })

  it('não usa o id no seletor estrutural, porque o framework o regenera', () => {
    setBody('<div><input id="tentry_1" /><input id="tentry_2" /></div>')
    const el = document.querySelectorAll('input')[1]!

    expect(extractSelectors(el).finder).not.toContain('tentry_2')
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

  it('descarta o seletor que o navegador nem aceita', () => {
    setBody('<button data-testid=\'com"aspas\'>Quebrado</button>')
    const el = document.querySelector('button')!

    expect(extractSelectors(el).dataTestId).toBeNull()
  })

  it('não tem seletor para elemento que saiu da página', () => {
    const el = document.createElement('button')

    el.id = 'solto'

    const selectors = extractSelectors(el)

    expect(selectors.finder).toBeNull()
    expect(selectors.cssStable).toBeNull()
    expect(selectors.xpath).toBeNull()
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
