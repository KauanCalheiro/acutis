import { Injectable, type OnModuleInit } from '@nestjs/common'
import { DomainEventBus } from '../../common/events/domain-event-bus.js'
import { RunFinished } from '../../modules/scenario/events/run-finished.js'
import { ScenarioService } from '../../modules/scenario/scenario.service.js'

@Injectable()
export class StoreRunHistory implements OnModuleInit {
    constructor(
        private readonly events: DomainEventBus,
        private readonly scenarios: ScenarioService
    ) {}

    onModuleInit(): void {
        this.events.subscribe(RunFinished, (event) => this.execute(event))
    }

    async execute(event: RunFinished): Promise<void> {
        if (event.spec) {
            await this.scenarios.persistRun(
                event.projectPath,
                event.spec,
                event.events,
                event.startedAt
            )

            return
        }

        await this.scenarios.persistRuns(event.projectPath, event.events, event.startedAt)
    }
}
