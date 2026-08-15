import { pruneHtml } from '../../runner/html.js'

/** Sobe o suficiente para pegar os irmãos do elemento, e não tanto que arraste a página inteira. */
const LEVELS = 3

/** A subárvore cabe no prompt; o documento não. */
const LIMIT = 8_000

/**
 * O pedaço do DOM ao redor do elemento no instante da ação. É o que responde a pergunta que o
 * seletor sozinho não responde: existem outros elementos iguais a este por perto, e o que os
 * distingue. O documento inteiro responderia igual e não caberia na janela de contexto.
 */
export function captureContext(el: Element, levels = LEVELS): string | null {
    if (!el.isConnected) return null

    let context: Element = el

    for (let level = 0; level < levels; level++) {
        const parent = context.parentElement

        if (!parent || parent === document.body || parent === document.documentElement) break

        context = parent
    }

    return pruneHtml(context.outerHTML, LIMIT)
}
