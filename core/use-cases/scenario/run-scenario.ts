import type { RunEvent } from '../../common/types/run.js'
import type { DomainEventBus } from '../../common/events/domain-event-bus.js'
import type { ProjectService } from '../../modules/project/project.service.js'
import { RunFinished } from '../../modules/scenario/events/run-finished.js'
import type { ScenarioRunner, ScenarioRunResult } from '../../modules/scenario/ports/scenario-runner.js'
import type { RunEventRecord } from '../../modules/scenario/scenario.service.js'
import { describeError } from '../../modules/telemetry/describe-error.js'
import type { ErrorReport } from '../../modules/telemetry/telemetry.service.js'

const OUTPUT_TAIL = 8_000

type ReportFailure = (report: ErrorReport) => Promise<unknown>

export class RunScenario {
  constructor(
    private readonly projects: ProjectService,
    private readonly runner: ScenarioRunner,
    private readonly events: DomainEventBus,
    private readonly reportFailure: ReportFailure = async () => false
  ) {}

  async execute(slug: string, spec?: string, grep?: string): Promise<ScenarioRunResult> {
    const path = this.projects.pathOf(slug)
    const env = this.projects.resolvedEnvironment(slug)

    try {
      return await this.runner.runProject(path, { spec, grep, env })
    } catch (error) {
      await this.report({ ...describeError(error), context: 'runner:execute', secrets: Object.values(env) })
      throw error
    }
  }

  /** `filter` é a busca que o usuário digitou; `grep` é o que ela virou para o Playwright. */
  async stream(
    slug: string,
    { spec, grep, filter }: { spec?: string, grep?: string, filter?: string },
    onEvent: (event: RunEvent) => void,
    signal?: AbortSignal
  ): Promise<ScenarioRunResult> {
    const path = this.projects.pathOf(slug)
    const env = this.projects.resolvedEnvironment(slug)
    const secrets = Object.values(env)
    const startedAt = new Date()
    const recorded: RunEventRecord[] = []
    let testRan = false

    let result: ScenarioRunResult
    try {
      result = await this.runner.streamProject(path, { spec, grep, env, signal }, (event) => {
        if (event.event === 'test') testRan = true
        recorded.push(event as unknown as RunEventRecord)
        onEvent(event)
      })
    } catch (error) {
      await this.report({ ...describeError(error), context: 'runner:stream', secrets })
      throw error
    }

    /** A execução interrompida não é resultado: entra no histórico como uma rodada que nunca houve. */
    if (signal?.aborted) return result

    if (!result.passed && !testRan) {
      await this.report({
        message: 'A execução terminou sem rodar nenhum teste.',
        stack: result.output.slice(-OUTPUT_TAIL),
        context: 'runner:stream',
        details: { spec: spec !== undefined, grep: grep !== undefined, events: recorded.length },
        secrets
      })
    }

    await this.events.publish(new RunFinished(path, spec, recorded, startedAt, filter))

    return result
  }

  private async report(report: ErrorReport): Promise<void> {
    await this.reportFailure(report).catch(() => false)
  }
}
