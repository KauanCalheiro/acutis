import type { RunEvent } from '../../../common/types/run.js'

export interface ScenarioRunResult {
  passed: boolean
  output: string
}

export interface ScenarioRunOptions {
  spec?: string
  grep?: string
  env?: Record<string, string>
  /** Abortar encerra o Playwright: é o cancelamento pedido na tela, o F5 e a aba fechada. */
  signal?: AbortSignal
}

export abstract class ScenarioRunner {
  abstract runProject(path: string, options: ScenarioRunOptions): Promise<ScenarioRunResult>
  abstract streamProject(
    path: string,
    options: ScenarioRunOptions,
    onEvent: (event: RunEvent) => void
  ): Promise<ScenarioRunResult>
}
