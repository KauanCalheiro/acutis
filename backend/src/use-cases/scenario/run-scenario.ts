import { Injectable } from '@nestjs/common'
import type { RunEvent } from '../../common/types/run.js'
import { DomainEventBus } from '../../common/events/domain-event-bus.js'
import { ProjectService } from '../../modules/project/project.service.js'
import { RunFinished } from '../../modules/scenario/events/run-finished.js'
import { ScenarioRunner, type ScenarioRunResult } from '../../modules/scenario/ports/scenario-runner.js'
import type { RunEventRecord } from '../../modules/scenario/scenario.service.js'

@Injectable()
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

    async stream(
        slug: string,
        spec: string | undefined,
        grep: string | undefined,
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

        await this.events.publish(new RunFinished(path, spec, recorded, startedAt))

        return result
    }
}
