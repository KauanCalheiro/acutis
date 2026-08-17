import { Injectable } from '@nestjs/common'
import { RunnerService } from '../../../webdriver/runner/runner.service.js'
import { ScenarioRunner, type ScenarioRunOptions, type ScenarioRunResult } from '../ports/scenario-runner.js'
import type { RunEvent } from '../../../common/types/run.js'

@Injectable()
export class WebdriverScenarioRunner implements ScenarioRunner {
    constructor(private readonly runner: RunnerService) {}

    runProject(path: string, options: ScenarioRunOptions): Promise<ScenarioRunResult> {
        return this.runner.runProject(path, options)
    }

    streamProject(
        path: string,
        options: ScenarioRunOptions,
        onEvent: (event: RunEvent) => void
    ): Promise<ScenarioRunResult> {
        return this.runner.streamProject(path, options, onEvent)
    }
}
