// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { DomainEventBus } from '../domain-event-bus.js'

class ExampleEvent {
  constructor(readonly value: string) {}
}

describe('DomainEventBus', () => {
  it('espera todos os handlers do evento terminarem', async () => {
    const bus = new DomainEventBus()
    const handler = vi.fn(async (event: ExampleEvent) => event.value)

    bus.subscribe(ExampleEvent, handler)
    await bus.publish(new ExampleEvent('pronto'))

    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ value: 'pronto' }))
  })
})
