// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { captureContext } from '../htmlContext'

function mount(html: string): void {
  document.body.innerHTML = html
}

describe('captureContext', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('carries the element itself', () => {
    mount('<main><section><div><button id="salvar">Salvar</button></div></section></main>')

    expect(captureContext(document.querySelector('#salvar')!)).toContain('id="salvar"')
  })

  it('carries the siblings, which is what tells two equal elements apart', () => {
    mount(`
            <main><section>
                <div><button class="btn">Salvar</button></div>
                <div><button class="btn">Salvar</button></div>
            </section></main>
        `)

    const html = captureContext(document.querySelectorAll('.btn')[0]!) ?? ''

    expect(html.match(/<button/g)).toHaveLength(2)
  })

  it('climbs only a few levels, so a deep page does not drag the whole document along', () => {
    mount('<main id="raiz"><section><article><div><span id="alvo">oi</span></div></article></section></main>')

    expect(captureContext(document.querySelector('#alvo')!)).not.toContain('id="raiz"')
  })

  it('stops at the body when the element sits near the top', () => {
    mount('<button id="solto">Salvar</button>')

    expect(captureContext(document.querySelector('#solto')!)).toContain('id="solto"')
  })

  it('prunes what does not help choosing a selector', () => {
    mount('<main><section><div><script>var x = 1</script><button id="ok">Ok</button></div></section></main>')

    const html = captureContext(document.querySelector('#ok')!)

    expect(html).not.toContain('var x = 1')
    expect(html).toContain('id="ok"')
  })

  it('has nothing to capture for an element that is not on the page', () => {
    expect(captureContext(document.createElement('div'))).toBeNull()
  })
})
