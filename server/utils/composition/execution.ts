import { DomainEventBus } from '@acutis/core/common/events/domain-event-bus.js'
import { ProjectService } from '@acutis/core/modules/project/project.service.js'
import { WebdriverScenarioRunner } from '@acutis/core/modules/scenario/providers/webdriver-scenario-runner.js'
import { RunScenario } from '@acutis/core/use-cases/scenario/run-scenario.js'
import { StoreRunHistory } from '@acutis/core/use-cases/scenario/store-run-history.js'
import { RunnerService } from '@acutis/core/webdriver/runner/runner.service.js'
import { scenarioUseCases } from './scenario'

const projects = new ProjectService()
let runner: RunnerService = new RunnerService()
let events: DomainEventBus
let run: RunScenario
const scenarios = scenarioUseCases()

function composeExecution(): void {
  events = new DomainEventBus()
  const history = new StoreRunHistory(events, scenarios)

  history.onModuleInit()
  run = new RunScenario(projects, new WebdriverScenarioRunner(runner), events)
}

composeExecution()

export function executionUseCases() {
  return { projects, scenarios, run }
}

export function executionRunner(): RunnerService {
  return runner
}

/** Permite que o harness use o mesmo dublê do runner que a aplicação usa. */
export function configureExecutionRunner(value: RunnerService): void {
  runner = value
  composeExecution()
}

export function resetExecutionRunner(): void {
  runner = new RunnerService()
  composeExecution()
}
