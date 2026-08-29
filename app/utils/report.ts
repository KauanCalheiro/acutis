import type { SuiteRun } from '#shared/contracts/report'

export interface ReportSummary {
  runs: number
  lastPassed: boolean | null
  successRate: number
  testSuccessRate: number
  averageDurationMs: number
  averageSteps: number
  totalSteps: number
  slowest: { title: string, durationMs: number } | null
  flaky: number
}

export interface ScenarioStat {
  id: string
  title: string
  runs: number
  failures: number
  failureRate: number
  averageDurationMs: number
  averageSteps: number
  lastPassed: boolean
  lastFailedStep: string | null
  flaky: boolean
  /** Um resultado por rodada, da mais antiga para a mais recente; null quando não rodou. */
  history: (boolean | null)[]
}

function percent(part: number, total: number): number {
  return total === 0 ? 0 : Math.round((part / total) * 1000) / 10
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length
}

/** As métricas da capa do relatório, tiradas das rodadas que vieram da API. */
export function summarizeRuns(runs: SuiteRun[]): ReportSummary {
  const tests = runs.flatMap(run => run.tests)
  const stats = scenarioStats(runs)
  const slowest = [...tests].sort((a, b) => b.duration_ms - a.duration_ms)[0]

  return {
    runs: runs.length,
    lastPassed: runs[0]?.passed ?? null,
    successRate: percent(runs.filter(run => run.passed).length, runs.length),
    testSuccessRate: percent(tests.filter(test => test.passed).length, tests.length),
    averageDurationMs: Math.round(average(runs.map(run => run.duration_ms))),
    averageSteps: Math.round(average(tests.map(test => test.steps)) * 10) / 10,
    totalSteps: tests.reduce((total, test) => total + test.steps, 0),
    slowest: slowest ? { title: slowest.title, durationMs: slowest.duration_ms } : null,
    flaky: stats.filter(stat => stat.flaky).length
  }
}

/** Um resumo por cenário, do que mais falha para o que menos falha. */
export function scenarioStats(runs: SuiteRun[]): ScenarioStat[] {
  const oldestFirst = [...runs].reverse()
  const ids = [...new Set(runs.flatMap(run => run.tests.map(test => test.id)))]

  return ids.map((id) => {
    const history = oldestFirst.map(run => run.tests.find(test => test.id === id)?.passed ?? null)
    const own = runs.flatMap(run => run.tests.filter(test => test.id === id))
    const failures = own.filter(test => !test.passed).length
    const results = history.filter((passed): passed is boolean => passed !== null)

    return {
      id,
      title: own[0]!.title,
      runs: own.length,
      failures,
      failureRate: percent(failures, own.length),
      averageDurationMs: Math.round(average(own.map(test => test.duration_ms))),
      averageSteps: Math.round(average(own.map(test => test.steps)) * 10) / 10,
      lastPassed: own[0]!.passed,
      lastFailedStep: own[0]!.failed_step,
      flaky: results.some((passed, index) => index > 0 && passed !== results[index - 1]),
      history
    }
  }).sort((a, b) => b.failures - a.failures || b.averageDurationMs - a.averageDurationMs)
}
