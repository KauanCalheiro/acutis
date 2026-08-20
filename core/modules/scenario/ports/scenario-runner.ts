import type { RunEvent } from '../../../common/types/run.js'

export interface ScenarioRunResult {
  passed: boolean
  output: string
}

export interface ScenarioRunOptions {
  spec?: string
  grep?: string
  env?: Record<string, string>
}

export abstract class ScenarioRunner {
  abstract runProject(path: string, options: ScenarioRunOptions): Promise<ScenarioRunResult>
  abstract streamProject(
    path: string,
    options: ScenarioRunOptions,
    onEvent: (event: RunEvent) => void
  ): Promise<ScenarioRunResult>
}
