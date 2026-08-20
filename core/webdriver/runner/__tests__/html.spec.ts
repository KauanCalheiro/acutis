import { describe, expect, it } from 'vitest'
import { pruneHtml } from '../html.js'

describe('pruneHtml', () => {
  it('drops script tags with everything inside them', () => {
    const html = '<div>antes</div><script>const x = 1; alert("oi")</script><div>depois</div>'

    expect(pruneHtml(html)).not.toContain('alert')
    expect(pruneHtml(html)).toContain('antes')
    expect(pruneHtml(html)).toContain('depois')
  })

  it('drops style tags with everything inside them', () => {
    const html = '<style>.btn { color: red }</style><button>Entrar</button>'

    expect(pruneHtml(html)).not.toContain('color: red')
    expect(pruneHtml(html)).toContain('Entrar')
  })

  it('drops svg subtrees, which are mostly path data', () => {
    const html = '<button><svg viewBox="0 0 24 24"><path d="M12 2L2 7v10"/></svg>Salvar</button>'

    expect(pruneHtml(html)).not.toContain('M12 2L2 7v10')
    expect(pruneHtml(html)).toContain('Salvar')
  })

  it('drops html comments', () => {
    expect(pruneHtml('<!-- comentário do build --><p>texto</p>')).not.toContain('comentário do build')
  })

  it('keeps the attributes that tell one element from another', () => {
    const html = '<input id="user" name="usuario" data-testid="login-usuario" aria-label="Usuário" class="input lg">'
    const pruned = pruneHtml(html)

    expect(pruned).toContain('id="user"')
    expect(pruned).toContain('name="usuario"')
    expect(pruned).toContain('data-testid="login-usuario"')
    expect(pruned).toContain('aria-label="Usuário"')
    expect(pruned).toContain('class="input lg"')
  })

  it('keeps duplicate elements apart, which is the whole point of reading the html', () => {
    const html = '<button class="btn">Salvar</button><button class="btn">Salvar</button>'

    expect(pruneHtml(html).match(/<button/g)).toHaveLength(2)
  })

  it('collapses the whitespace that indentation left behind', () => {
    const html = '<div>\n\n        <span>oi</span>\n\n        </div>'

    expect(pruneHtml(html)).not.toContain('\n\n')
  })

  it('truncates past the limit, so one page cannot blow the context window', () => {
    const html = `<p>${'a'.repeat(500)}</p>`

    expect(pruneHtml(html, 100).length).toBeLessThanOrEqual(100)
  })

  it('says it truncated, so nobody reads a cut page as the whole page', () => {
    const html = `<p>${'a'.repeat(500)}</p>`

    expect(pruneHtml(html, 100)).toContain('truncado')
  })

  it('leaves a page that already fits untouched by the limit', () => {
    expect(pruneHtml('<p>curto</p>', 100)).not.toContain('truncado')
  })
})
