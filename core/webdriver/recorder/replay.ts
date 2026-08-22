/**
 * Os passos que o navegador refaz para a gravação continuar de onde o usuário parou. Só o que
 * recoloca a página no mesmo estado entra: submit, hover e assert não mexem no estado, e valor
 * mascarado ou já virado marcador não existe mais para ser digitado.
 */
import type { RecordingEvent, RecordingSelectors } from '../../common/types/recording.js'
import { MASK } from '../../modules/recording/recording.js'

/** O que a cortina da pill pergunta: se a ferramenta ainda está agindo, e em que passo travou. */
export interface ReplayState {
  status: 'idle' | 'running' | 'failed'
  step: string | null
}

export type ReplayStep
  = | { action: 'goto', url: string, label: string }
    | { action: 'fill', selector: string, value: string, label: string }
    | { action: 'click', selector: string, label: string }

function attribute(name: string, value: string): string {
  return `[${name}=${JSON.stringify(value)}]`
}

/** O seletor mais estável que o evento gravou, na mesma ordem de preferência do spec emitido. */
export function replaySelector(selectors: RecordingSelectors | null): string | null {
  if (!selectors) return null

  if (selectors.dataTestId) return attribute('data-testid', selectors.dataTestId)
  if (selectors.dataCy) return attribute('data-cy', selectors.dataCy)
  if (selectors.id) return attribute('id', selectors.id)
  if (selectors.cssStable) return selectors.cssStable
  if (selectors.ariaLabel) return attribute('aria-label', selectors.ariaLabel)
  if (selectors.placeholder) return attribute('placeholder', selectors.placeholder)
  if (selectors.text) return `text=${JSON.stringify(selectors.text)}`
  if (selectors.finder) return selectors.finder
  if (selectors.xpath) return `xpath=${selectors.xpath}`

  return null
}

/** Valor que o navegador ainda consegue digitar: o mascarado e o marcador de ambiente não são. */
function typeable(value: string | null): value is string {
  return value !== null && value !== '' && value !== MASK && !/^\{\{.+\}\}$/.test(value)
}

/** Como o passo é chamado no aviso de falha: o que a gravação sabe do elemento, ou nada. */
function named(event: RecordingEvent): string | null {
  const source = event.label ?? event.innerText ?? event.selectors?.text ?? ''
  const clean = source.replace(/\s+/gu, ' ').trim()

  return clean === '' ? null : clean
}

function pathOf(url: string): string {
  try {
    return new URL(url).pathname
  } catch {
    return url
  }
}

export function replaySteps(events: RecordingEvent[]): ReplayStep[] {
  const steps: ReplayStep[] = []

  for (const event of events) {
    if (event.type === 'navigate') {
      if (event.url) steps.push({ action: 'goto', url: event.url, label: `Abre ${pathOf(event.url)}` })
      continue
    }

    const selector = replaySelector(event.selectors)

    if (!selector) continue

    const name = named(event)

    if (event.type === 'click') {
      steps.push({
        action: 'click',
        selector,
        label: name === null ? 'Clica no elemento' : `Clica em "${name}"`
      })
    }

    if (event.type === 'fill' && typeable(event.value)) {
      steps.push({
        action: 'fill',
        selector,
        value: event.value,
        label: name === null ? 'Preenche o campo' : `Preenche "${name}"`
      })
    }
  }

  return steps
}
