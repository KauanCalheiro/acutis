import { Injectable } from '@nestjs/common'

type EventConstructor<T extends object> = new (...args: never[]) => T
type EventHandler<T extends object> = (event: T) => void | Promise<void>

@Injectable()
export class DomainEventBus {
    private readonly handlers = new Map<EventConstructor<object>, EventHandler<object>[]>()

    subscribe<T extends object>(event: EventConstructor<T>, handler: EventHandler<T>): void {
        const handlers = this.handlers.get(event as EventConstructor<object>) ?? []

        handlers.push(handler as EventHandler<object>)
        this.handlers.set(event as EventConstructor<object>, handlers)
    }

    async publish<T extends object>(event: T): Promise<void> {
        const handlers = this.handlers.get(event.constructor as EventConstructor<object>) ?? []

        await Promise.all(handlers.map((handler) => handler(event)))
    }
}
