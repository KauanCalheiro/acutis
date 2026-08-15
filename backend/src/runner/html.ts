const SCRIPT = /<script\b[^>]*>[\s\S]*?<\/script\s*>/gi
const STYLE = /<style\b[^>]*>[\s\S]*?<\/style\s*>/gi
const SVG = /<svg\b[^>]*>[\s\S]*?<\/svg\s*>/gi
const COMMENT = /<!--[\s\S]*?-->/g
const INDENT = /\s*\n\s*/g

const TRUNCATED = '<!-- truncado -->'

/** Acima disto o HTML deixa de caber junto do resto do prompt e vira ruído. */
const LIMIT = 60_000

/**
 * O HTML da página sem o que não distingue um elemento do outro. Script, style e svg são a maior
 * parte do peso de uma tela real e nenhum deles ajuda a escolher seletor; o que fica é a estrutura
 * com os atributos que identificam, que é o que responde "há dois botões iguais aqui?".
 *
 * A captura é crua no navegador e a poda acontece aqui, do lado do Node, para ser lógica pura.
 */
export function pruneHtml(html: string, limit = LIMIT): string {
    const pruned = html
        .replace(SCRIPT, '')
        .replace(STYLE, '')
        .replace(SVG, '')
        .replace(COMMENT, '')
        .replace(INDENT, '\n')
        .trim()

    if (pruned.length <= limit) return pruned

    return pruned.slice(0, limit - TRUNCATED.length) + TRUNCATED
}
