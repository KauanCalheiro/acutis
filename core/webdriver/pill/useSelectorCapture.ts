import { finder } from '@medv/finder'
import type { RecordingSelectors } from '@/common/types/recording'

function isUnique(selector: string): boolean {
  try {
    return document.querySelectorAll(selector).length === 1
  } catch {
    return false
  }
}

const HIDDEN_ANCESTOR = '[hidden], [aria-hidden="true"], dialog:not([open])'

function isVisible(el: Element): boolean {
  if (el.closest(HIDDEN_ANCESTOR)) return false

  const style = getComputedStyle(el)

  return style.display !== 'none' && style.visibility !== 'hidden'
}

/** Único na página, ou o único visível entre gêmeos que ficaram escondidos num modal fechado. */
function uniqueAmongVisible(selector: string): boolean {
  try {
    return Array.from(document.querySelectorAll(selector)).filter(isVisible).length === 1
  } catch {
    return false
  }
}

function isXPathUnique(xpath: string): boolean {
  try {
    const result = document.evaluate(`count(${xpath})`, document, null, XPathResult.NUMBER_TYPE, null)
    return result.numberValue === 1
  } catch {
    return false
  }
}

function uniqueOrNull(selector: string | null): string | null {
  if (!selector) return null
  return isUnique(selector) ? selector : null
}

const TEXT_SELECTOR_MAX = 80

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * O texto só serve de seletor quando um único elemento da página o carrega. O elemento cujo filho
 * repete o texto inteiro fica de fora.
 */
function uniqueText(el: Element): string | null {
  const text = normalizeText(el.textContent)

  if (!text || text.length > TEXT_SELECTOR_MAX) {
    return null
  }

  const carriers = Array.from(document.querySelectorAll('*')).filter((candidate) => {
    if (normalizeText(candidate.textContent) !== text) return false

    return !Array.from(candidate.children).some(child => normalizeText(child.textContent) === text)
  })

  return carriers.length === 1 ? text : null
}

function buildFinderSelector(el: Element): string | null {
  if (!el.isConnected) return null

  try {
    const sel = finder(el, { idName: () => false })
    return uniqueOrNull(sel)
  } catch {
    return null
  }
}

function buildXPath(el: Element): string | null {
  const parts: string[] = []
  let node: Node | null = el
  while (node && node.nodeType === Node.ELEMENT_NODE) {
    const element = node as Element
    const tag = element.tagName.toLowerCase()
    let index = 1
    let sibling = node.previousSibling
    while (sibling) {
      if (sibling.nodeType === Node.ELEMENT_NODE && (sibling as Element).tagName === element.tagName) index++
      sibling = sibling.previousSibling
    }
    parts.unshift(`${tag}[${index}]`)
    node = node.parentNode
  }
  const xpath = '/' + parts.join('/')
  return isXPathUnique(xpath) ? xpath : null
}

const SEMANTIC_ATTRIBUTES = ['data-testid', 'data-cy', 'aria-label', 'name'] as const

function nameSelector(el: Element): string | null {
  const name = el.getAttribute('name')

  return name ? `${el.tagName.toLowerCase()}[name="${name}"]` : null
}

/** O seletor do elemento por atributo que a aplicação escreveu; o id gerado não conta. */
function semanticSelector(el: Element): string | null {
  const attribute = SEMANTIC_ATTRIBUTES.find(candidate => el.getAttribute(candidate))

  if (!attribute) return null

  return attribute === 'name'
    ? nameSelector(el)
    : `[${attribute}="${el.getAttribute(attribute)}"]`
}

/** O ancestral semântico mais próximo que torna o seletor do elemento único. */
function scopedSelector(el: Element, own: string): string | null {
  for (let parent = el.parentElement; parent; parent = parent.parentElement) {
    const scope = semanticSelector(parent)

    if (!scope || !isUnique(scope)) continue

    const scoped = `${scope} ${own}`

    if (isUnique(scoped)) return scoped
  }

  return null
}

function buildCssStableSelector(el: Element): string | null {
  const own = nameSelector(el)
  if (own) {
    if (isUnique(own)) return own

    const scoped = scopedSelector(el, own)
    if (scoped) return scoped
  }
  if (el.id) {
    const sel = `#${CSS.escape(el.id)}`
    if (isUnique(sel)) return sel
  }
  return null
}

export function useSelectorCapture() {
  function extractSelectors(el: Element): RecordingSelectors {
    const dataTestId = el.getAttribute('data-testid')
    const dataCy = el.getAttribute('data-cy')
    const ariaLabel = el.getAttribute('aria-label')
    const placeholder = el.getAttribute('placeholder')

    const testIdSel = dataTestId ? `[data-testid="${dataTestId}"]` : null
    const dataCySel = dataCy ? `[data-cy="${dataCy}"]` : null
    const ariaLabelSel = ariaLabel ? `[aria-label="${ariaLabel}"]` : null
    const placeholderSel = placeholder ? `[placeholder="${placeholder}"]` : null

    const testIdTwins = !!testIdSel && !isUnique(testIdSel) && uniqueAmongVisible(testIdSel)

    return {
      dataTestId: testIdSel && (isUnique(testIdSel) || testIdTwins) ? dataTestId : null,
      hiddenTwins: testIdTwins,
      dataCy: dataCySel && isUnique(dataCySel) ? dataCy : null,
      ariaLabel: ariaLabelSel && isUnique(ariaLabelSel) ? ariaLabel : null,
      ariaRole: el.getAttribute('role'),
      id: el.id || null,
      name: el.getAttribute('name'),
      placeholder: placeholderSel && isUnique(placeholderSel) ? placeholder : null,
      cssStable: buildCssStableSelector(el),
      xpath: buildXPath(el),
      text: uniqueText(el),
      finder: buildFinderSelector(el)
    }
  }

  return { extractSelectors }
}
