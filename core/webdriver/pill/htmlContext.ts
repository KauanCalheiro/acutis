import { pruneHtml } from '../runner/html.js'

/** Sobe o suficiente para pegar os irmãos do elemento, e não tanto que arraste a página inteira. */
const LEVELS = 3

/** A subárvore cabe no prompt; o documento não. */
const LIMIT = 8_000

/**
 * O pedaço do DOM ao redor do elemento no instante da ação, que é o que mostra quais outros
 * elementos parecidos existem por perto.
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
