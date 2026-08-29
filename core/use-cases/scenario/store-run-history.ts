import type { DomainEventBus } from '../../common/events/domain-event-bus.js'
import { RunFinished } from '../../modules/scenario/events/run-finished.js'
import type { ScenarioService } from '../../modules/scenario/scenario.service.js'

export class StoreRunHistory {
  constructor(
    private readonly events: DomainEventBus,
    private readonly scenarios: ScenarioService
  ) {}

  onModuleInit(): void {
    this.events.subscribe(RunFinished, event => this.execute(event))
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

    await this.scenarios.persistRuns(event.projectPath, event.events, event.startedAt, event.filter)
  }
}
