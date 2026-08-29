import { describe, it, expect } from 'vitest'
import { scenarioStats, summarizeRuns } from '~/utils/report'
import type { SuiteRun, SuiteRunTest } from '#shared/contracts/report'

function test(overrides: Partial<SuiteRunTest> = {}): SuiteRunTest {
  return {
    id: 'entrar',
    title: 'Entrar',
    spec: 'tests/entrar.spec.ts',
    passed: true,
    duration_ms: 1000,
    steps: 4,
    failed_step: null,
    ...overrides
  }
}

/** As rodadas chegam da mais recente para a mais antiga, como a API as devolve. */
function run(overrides: Partial<SuiteRun> = {}): SuiteRun {
  const tests = overrides.tests ?? [test()]

  return {
    started_at: '2026-08-28T17:00:00.000Z',
    duration_ms: tests.reduce((total, item) => total + item.duration_ms, 0),
    passed: tests.every(item => item.passed),
    filter: null,
    branch: 'main',
    author: 'Kauan',
    totals: {
      tests: tests.length,
      passed: tests.filter(item => item.passed).length,
      failed: tests.filter(item => !item.passed).length,
      steps: tests.reduce((total, item) => total + item.steps, 0)
    },
    ...overrides,
    tests
  }
}

describe('summarizeRuns', () => {
  it('devolve tudo zerado quando o projeto nunca rodou', () => {
    const summary = summarizeRuns([])

    expect(summary.runs).toBe(0)
    expect(summary.successRate).toBe(0)
    expect(summary.slowest).toBeNull()
  })

  it('conta a taxa de sucesso das rodadas e dos cenários', () => {
    const summary = summarizeRuns([
      run({ tests: [test(), test({ id: 'comprar', passed: false })] }),
      run({ tests: [test(), test({ id: 'comprar' })] })
    ])

    expect(summary.runs).toBe(2)
    expect(summary.successRate).toBe(50)
    expect(summary.testSuccessRate).toBe(75)
  })

  it('calcula duração média, steps por cenário e o cenário mais lento', () => {
    const summary = summarizeRuns([
      run({ tests: [test({ duration_ms: 2000, steps: 6 }), test({ id: 'comprar', title: 'Comprar', duration_ms: 8000, steps: 4 })] }),
      run({ tests: [test({ duration_ms: 1000, steps: 6 })] })
    ])

    expect(summary.averageDurationMs).toBe(5500)
    expect(summary.averageSteps).toBe(5.3)
    expect(summary.totalSteps).toBe(16)
    expect(summary.slowest).toEqual({ title: 'Comprar', durationMs: 8000 })
  })

  it('conta como instável o cenário que troca de resultado entre rodadas', () => {
    const summary = summarizeRuns([
      run({ tests: [test({ passed: false }), test({ id: 'comprar' })] }),
      run({ tests: [test({ passed: true }), test({ id: 'comprar' })] })
    ])

    expect(summary.flaky).toBe(1)
  })
})

describe('scenarioStats', () => {
  it('resume cada cenário pelas rodadas em que ele apareceu', () => {
    const stats = scenarioStats([
      run({ tests: [test({ passed: false, duration_ms: 3000, failed_step: 'Pagar' })] }),
      run({ tests: [test({ duration_ms: 1000 })] })
    ])

    expect(stats).toHaveLength(1)
    expect(stats[0]).toMatchObject({
      id: 'entrar',
      title: 'Entrar',
      runs: 2,
      failures: 1,
      failureRate: 50,
      averageDurationMs: 2000,
      lastPassed: false,
      flaky: true
    })
  })

  it('guarda o resultado por rodada da mais antiga para a mais recente', () => {
    const stats = scenarioStats([
      run({ tests: [test({ passed: false })] }),
      run({ tests: [] }),
      run({ tests: [test()] })
    ])

    expect(stats[0]!.history).toEqual([true, null, false])
  })

  it('ordena do que mais falha para o que menos falha', () => {
    const stats = scenarioStats([
      run({ tests: [test(), test({ id: 'comprar', title: 'Comprar', passed: false })] })
    ])

    expect(stats.map(stat => stat.id)).toEqual(['comprar', 'entrar'])
  })
})
