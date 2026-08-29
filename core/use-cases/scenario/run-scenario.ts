import type { RunEvent } from '../../common/types/run.js'
import type { DomainEventBus } from '../../common/events/domain-event-bus.js'
import type { ProjectService } from '../../modules/project/project.service.js'
import { RunFinished } from '../../modules/scenario/events/run-finished.js'
import type { ScenarioRunner, ScenarioRunResult } from '../../modules/scenario/ports/scenario-runner.js'
import type { RunEventRecord } from '../../modules/scenario/scenario.service.js'

export class RunScenario {
  constructor(
    private readonly projects: ProjectService,
    private readonly runner: ScenarioRunner,
    private readonly events: DomainEventBus
  ) {}

  execute(slug: string, spec?: string, grep?: string): Promise<ScenarioRunResult> {
    const path = this.projects.pathOf(slug)
    const env = this.projects.resolvedEnvironment(slug)

    return this.runner.runProject(path, { spec, grep, env })
  }

  /** `filter` é a busca que o usuário digitou; `grep` é o que ela virou para o Playwright. */
  async stream(
    slug: string,
    { spec, grep, filter }: { spec?: string, grep?: string, filter?: string },
    onEvent: (event: RunEvent) => void
  ): Promise<ScenarioRunResult> {
    const path = this.projects.pathOf(slug)
    const env = this.projects.resolvedEnvironment(slug)
    const startedAt = new Date()
    const recorded: RunEventRecord[] = []

    const result = await this.runner.streamProject(path, { spec, grep, env }, (event) => {
      recorded.push(event as unknown as RunEventRecord)
      onEvent(event)
    })

    await this.events.publish(new RunFinished(path, spec, recorded, startedAt, filter))

    return result
  }
}
