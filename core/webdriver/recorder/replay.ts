/**
 * Os passos que o navegador refaz para a gravação continuar de onde o usuário parou. Só o que
 * recoloca a página no mesmo estado entra: submit, hover e assert não mexem no estado, e valor
 * mascarado ou já virado marcador não existe mais para ser digitado.
 */
import { pathOf } from '../../common/playwright/url.js'
import type { RecordingEvent, RecordingSelectors } from '../../common/types/recording.js'
import { describeElement, MASK } from '../../modules/recording/recording.js'

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

function attribute(name: string, value: string): string {
  return `[${name}=${JSON.stringify(value)}]`
}

/** O seletor mais estável que o evento gravou, na mesma ordem de preferência do spec emitido. */
export function replaySelector(selectors: RecordingSelectors | null): string | null {
  if (!selectors) return null

  if (selectors.dataTestId) {
    return attribute('data-testid', selectors.dataTestId) + (selectors.hiddenTwins ? ':visible' : '')
  }
  if (selectors.dataCy) return attribute('data-cy', selectors.dataCy)
  if (selectors.ariaLabel) return attribute('aria-label', selectors.ariaLabel)
  if (selectors.placeholder) return attribute('placeholder', selectors.placeholder)
  if (selectors.id) return attribute('id', selectors.id)
  if (selectors.cssStable) return selectors.cssStable
  if (selectors.text) return `text=${JSON.stringify(selectors.text)}`
  if (selectors.finder) return selectors.finder
  if (selectors.xpath) return `xpath=${selectors.xpath}`

  return null
}

/** Valor que o navegador ainda consegue digitar: o mascarado e o marcador de ambiente não são. */
function typeable(value: string | null): value is string {
  return value !== null && value !== '' && value !== MASK && !/^\{\{.+\}\}$/.test(value)
}

export function replaySteps(events: RecordingEvent[]): ReplayStep[] {
  const steps: ReplayStep[] = []

  events.forEach((event, at) => {
    if (event.type === 'navigate') {
      if (event.url) {
        steps.push({ action: 'goto', url: event.url, label: `Abre ${pathOf(event.url, event.url)}`, at })
      }
      return
    }

    const selector = replaySelector(event.selectors)

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
