// @vitest-environment node
/** O clique que a página segura pelo duplo clique, guardado também do lado do Node. */
import { describe, expect, it } from 'vitest'
import type { RecordingEvent } from '../../../common/types/recording.js'
import { HeldClickGuard } from '../held-click.js'

function event(partial: Partial<RecordingEvent>): RecordingEvent {
  return {
    type: 'click',
    timestamp: 1000,
    url: 'http://loja.test/login',
    selectors: null,
    label: null,
    value: null,
    sensitive: false,
    tagName: null,
    innerText: null,
    inputType: null,
    checked: null,
    ...partial
  }
}

function guardRecording() {
  const emitted: RecordingEvent[] = []
  const guard = new HeldClickGuard(recorded => emitted.push(recorded))

  return { guard, steps: () => emitted.map(recorded => `${recorded.type}:${recorded.timestamp}`) }
}

describe('HeldClickGuard', () => {
  it('entrega o clique retido antes do primeiro evento da página que substituiu a dele', () => {
    const { guard, steps } = guardRecording()

    guard.hold(event({ type: 'click', timestamp: 1000 }))
    guard.report(event({ type: 'navigate', timestamp: 1090, url: 'http://sso.test/login' }))

    expect(steps()).toEqual(['click:1000', 'navigate:1090'])
  })

  it('entrega uma vez só o clique que a própria página soltou', () => {
    const { guard, steps } = guardRecording()

    guard.hold(event({ type: 'click', timestamp: 2000 }))
    guard.report(event({ type: 'click', timestamp: 2000 }))

    expect(steps()).toEqual(['click:2000'])
  })

  it('deixa o duplo clique tomar o lugar do clique retido', () => {
    const { guard, steps } = guardRecording()

    guard.hold(event({ type: 'click', timestamp: 3000 }))
    guard.report(event({ type: 'dblclick', timestamp: 3090 }))

    expect(steps()).toEqual(['dblclick:3090'])
  })

  it('entrega no encerramento o clique que nenhuma página soltou', () => {
    const { guard, steps } = guardRecording()

    guard.hold(event({ type: 'click', timestamp: 4000 }))
    guard.flush()

    expect(steps()).toEqual(['click:4000'])
  })
})
