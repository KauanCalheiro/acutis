/**
 * A ordem em que os seletores gravados são tentados até um servir. O projeto pode reordenar a
 * lista no manifesto, que é como uma aplicação de `id` volátil deixa de gerar spec instável.
 */
export type SelectorKey
  = | 'dataTestId' | 'dataCy' | 'ariaLabel' | 'placeholder' | 'cssStable' | 'id' | 'text'
    | 'finder' | 'xpath'

export const DEFAULT_SELECTOR_PRIORITY: SelectorKey[] = [
  'dataTestId',
  'dataCy',
  'ariaLabel',
  'placeholder',
  'cssStable',
  'id',
  'text',
  'finder',
  'xpath'
]

function isSelectorKey(value: string): value is SelectorKey {
  return (DEFAULT_SELECTOR_PRIORITY as string[]).includes(value)
}

/** A ordem configurada, sem nome desconhecido nem repetição, completada com o que faltou. */
export function selectorOrder(configured: string[] | null | undefined): SelectorKey[] {
  const chosen = (configured ?? []).filter(isSelectorKey)
  const order = [...new Set(chosen)]

  return [...order, ...DEFAULT_SELECTOR_PRIORITY.filter(key => !order.includes(key))]
}

/** A chave do primeiro seletor que o elemento gravou; cada camada traduz para o locator dela. */
export function chooseSelector(
  selectors: Partial<Record<SelectorKey, string | null>> | null | undefined,
  order: SelectorKey[]
): SelectorKey | null {
  if (!selectors) return null

  return order.find(key => selectors[key]) ?? null
}
