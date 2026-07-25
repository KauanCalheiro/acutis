import type { RecorderEvent } from '~/composables/webdriver'

export function describeRecorderEvent(event: RecorderEvent): string {
  const selector = event.selectors
  return event.label || selector?.text || selector?.dataTestId || selector?.cssStable || event.url || event.type || ''
}
