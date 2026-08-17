import { Global, Module } from '@nestjs/common'
import { DomainEventBus } from './domain-event-bus.js'

@Global()
@Module({
    providers: [DomainEventBus],
    exports: [DomainEventBus]
})
export class DomainEventsModule {}
