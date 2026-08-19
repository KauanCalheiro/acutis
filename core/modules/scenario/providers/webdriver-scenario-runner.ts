import type { RunnerService } from '../../../webdriver/runner/runner.service.js'
import type { ScenarioRunner, ScenarioRunOptions, ScenarioRunResult } from '../ports/scenario-runner.js'
import type { RunEvent } from '../../../common/types/run.js'

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
