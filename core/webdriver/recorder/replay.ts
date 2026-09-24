/**
 * Os passos que o navegador refaz para a gravação continuar de onde o usuário parou. Só o que
 * recoloca a página no mesmo estado entra: submit, hover e assert não mexem no estado, e valor
 * mascarado ou já virado marcador não existe mais para ser digitado.
 */
import { pathOf } from '../../common/playwright/url.js'
import type { RecordingEvent, RecordingSelectors } from '../../common/types/recording.js'
import { describeElement, MASK } from '../../modules/recording/recording.js'
import {
  chooseSelector,
  DEFAULT_SELECTOR_PRIORITY,
  type SelectorKey
} from '../../modules/recording/selector-priority.js'

/** O que a cortina da pill pergunta: se a ferramenta ainda está agindo, e em que passo travou. */
export interface ReplayState {
  status: 'idle' | 'running' | 'failed'
  step: string | null
}

/** `at` é o índice do evento que originou o passo: é onde a gravação é cortada se ele falhar. */
export type ReplayStep
  = | { action: 'goto', url: string, label: string, at: number }
    | { action: 'fill', selector: string, value: string, label: string, at: number }
    | { action: 'click', selector: string, label: string, at: number }
    | { action: 'dblclick', selector: string, label: string, at: number }

function attribute(name: string, value: string): string {
  return `[${name}=${JSON.stringify(value)}]`
}

/** O seletor mais estável que o evento gravou, na mesma ordem de preferência do spec emitido. */
export function replaySelector(
  selectors: RecordingSelectors | null,
  order: SelectorKey[] = DEFAULT_SELECTOR_PRIORITY
): string | null {
  const chosen = chooseSelector(selectors, order)

  if (!selectors || chosen === null) return null

  switch (chosen) {
    case 'dataTestId':
      return attribute('data-testid', selectors.dataTestId!) + (selectors.hiddenTwins ? ':visible' : '')
    case 'dataCy': return attribute('data-cy', selectors.dataCy!)
    case 'ariaLabel': return attribute('aria-label', selectors.ariaLabel!)
    case 'placeholder': return attribute('placeholder', selectors.placeholder!)
    case 'cssStable': return selectors.cssStable!
    case 'id': return attribute('id', selectors.id!)
    case 'text': return `text=${JSON.stringify(selectors.text)}` + (selectors.textHiddenTwins ? ' >> visible=true' : '')
    case 'finder': return selectors.finder!
    case 'xpath': return `xpath=${selectors.xpath}`
  }
}

/** Valor que o navegador ainda consegue digitar: o mascarado e o marcador de ambiente não são. */
function typeable(value: string | null): value is string {
  return value !== null && value !== '' && value !== MASK && !/^\{\{.+\}\}$/.test(value)
}

export function replaySteps(
  events: RecordingEvent[],
  order: SelectorKey[] = DEFAULT_SELECTOR_PRIORITY
): ReplayStep[] {
  const steps: ReplayStep[] = []

  events.forEach((event, at) => {
    if (event.type === 'navigate') {
      if (event.url) {
        steps.push({ action: 'goto', url: event.url, label: `Abre ${pathOf(event.url, event.url)}`, at })
      }
      return
    }

    const selector = replaySelector(event.selectors, order)

    if (!selector) return

    const name = describeElement(event)

    if (event.type === 'click') {
      steps.push({
        action: 'click',
        selector,
        label: name === null ? 'Clica no elemento' : `Clica em "${name}"`,
        at
      })
    }

    if (event.type === 'dblclick') {
      steps.push({
        action: 'dblclick',
        selector,
        label: name === null ? 'Clica duas vezes no elemento' : `Clica duas vezes em "${name}"`,
        at
      })
    }

    if (event.type === 'fill' && typeable(event.value)) {
      steps.push({
        action: 'fill',
        selector,
        value: event.value,
        label: name === null ? 'Preenche o campo' : `Preenche "${name}"`,
        at
      })
    }
  })

  return steps
}
