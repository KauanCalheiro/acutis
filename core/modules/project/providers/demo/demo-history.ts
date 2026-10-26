/** As rodadas mocadas do projeto de exemplo, datadas a partir de um instante. */
import type { SuiteRun, SuiteRunTest } from '#shared/contracts/report'
import type { ScenarioRunStep } from '#shared/contracts/scenario'
import type { Run } from '../../../scenario/providers/runs.js'
import type { DemoScenario } from './swag-labs.js'

export const DEMO_ROUNDS = 15

const HOUR_MS = 60 * 60 * 1000

const HOURS_BETWEEN_ROUNDS = 19

const LATEST_ROUND_HOURS_AGO = 2

const SETUP_MS = 1500

const BRANCH = 'main'

const AUTHOR = 'Ana Souza'

const BASE_DURATION_MS: Record<string, number> = {
  'adicionar-produto-ao-carrinho': 4200,
  'finalizar-compra': 9800,
  'ordenar-produtos-por-preco': 3100
}

const FAILED_ROUNDS: Record<string, number[]> = {
  'finalizar-compra': [3, 7, 8, 12, 14],
  'ordenar-produtos-por-preco': [5]
}

const TIMEOUT_ERROR = 'Timed out 5000ms waiting for expect(locator).toHaveText(expected)'

const TIMEOUT_EXTRA_MS = 5000

const STEP_SHARES = [0.3, 0.3, 0.4]

export interface DemoRound {
  suite: SuiteRun
  scenarios: Map<string, Run>
}

function roundStart(now: Date, round: number): Date {
  const hoursAgo = LATEST_ROUND_HOURS_AGO + (DEMO_ROUNDS - 1 - round) * HOURS_BETWEEN_ROUNDS

  return new Date(now.getTime() - hoursAgo * HOUR_MS)
}

function failedIn(scenario: DemoScenario, round: number): boolean {
  return FAILED_ROUNDS[scenario.id]?.includes(round) ?? false
}

function durationOf(scenario: DemoScenario, round: number, index: number): number {
  const jitter = (((round * 37) + (index * 53)) % 11 - 5) * 120
  const trend = round * 40
  const timeout = failedIn(scenario, round) ? TIMEOUT_EXTRA_MS : 0

  return (BASE_DURATION_MS[scenario.id] ?? 3000) + jitter + trend + timeout
}

function stepsOf(scenario: DemoScenario, duration: number, failed: boolean): ScenarioRunStep[] {
  const last = scenario.steps.length - 1

  return scenario.steps.map((title, index) => ({
    title,
    status: failed && index === last ? 'failed' : 'success',
    duration_ms: Math.round(duration * (STEP_SHARES[index] ?? 0)),
    error: failed && index === last ? TIMEOUT_ERROR : null
  }))
}

function suiteTestOf(scenario: DemoScenario, steps: ScenarioRunStep[], duration: number): SuiteRunTest {
  return {
    id: scenario.id,
    title: scenario.title,
    spec: `tests/${scenario.id}.spec.ts`,
    passed: steps.every(step => step.status === 'success'),
    duration_ms: duration,
    steps: steps.length,
    failed_step: steps.find(step => step.status === 'failed')?.title ?? null
  }
}

/** Uma rodada do projeto inteiro e a execução que cada cenário guardou dela. */
function demoRound(scenarios: DemoScenario[], now: Date, round: number): DemoRound {
  const startedAt = roundStart(now, round)
  const tests: SuiteRunTest[] = []
  const runs = new Map<string, Run>()
  let elapsed = SETUP_MS

  scenarios.forEach((scenario, index) => {
    const duration = durationOf(scenario, round, index)
    const failed = failedIn(scenario, round)
    const steps = stepsOf(scenario, duration, failed)

    runs.set(scenario.id, {
      started_at: new Date(startedAt.getTime() + elapsed).toISOString(),
      duration_ms: duration,
      passed: !failed,
      branch: BRANCH,
      author: AUTHOR,
      steps,
      playwright: scenario.playwright,
      video: false
    })
    tests.push(suiteTestOf(scenario, steps, duration))
    elapsed += duration
  })

  const passed = tests.filter(test => test.passed).length

  return {
    suite: {
      started_at: startedAt.toISOString(),
      duration_ms: elapsed,
      passed: passed === tests.length,
      filter: null,
      branch: BRANCH,
      author: AUTHOR,
      totals: {
        tests: tests.length,
        passed,
        failed: tests.length - passed,
        steps: tests.reduce((total, test) => total + test.steps, 0)
      },
      tests
    },
    scenarios: runs
  }
}

/** As rodadas do exemplo, da mais antiga para a mais recente. */
export function demoRounds(scenarios: DemoScenario[], now: Date): DemoRound[] {
  return Array.from({ length: DEMO_ROUNDS }, (_, round) => demoRound(scenarios, now, round))
}

/** As execuções do login, uma antes de cada rodada, todas verdes. */
export function demoAuthRuns(auth: DemoScenario, rounds: DemoRound[]): Run[] {
  return rounds.map(({ suite }) => ({
    started_at: suite.started_at,
    duration_ms: SETUP_MS,
    passed: true,
    branch: BRANCH,
    author: AUTHOR,
    steps: stepsOf(auth, SETUP_MS, false),
    playwright: auth.playwright,
    video: false
  }))
}
