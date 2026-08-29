import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectReportDonut from '~/components/project/report/donut.vue'
import ProjectReportTrend from '~/components/project/report/trend.vue'
import ProjectReportStacked from '~/components/project/report/stacked.vue'
import ProjectReportMatrix from '~/components/project/report/matrix.vue'
import ProjectReportRanking from '~/components/project/report/ranking.vue'
import ProjectReportRuns from '~/components/project/report/runs.vue'
import { mountInApp } from '../../support/app'
import type { SuiteRun } from '#shared/contracts/report'
import type { ScenarioStat } from '~/utils/report'

function stat(overrides: Partial<ScenarioStat> = {}): ScenarioStat {
  return {
    id: 'entrar',
    title: 'Entrar',
    runs: 2,
    failures: 0,
    failureRate: 0,
    averageDurationMs: 1000,
    averageSteps: 4,
    lastPassed: true,
    lastFailedStep: null,
    flaky: false,
    history: [true, true],
    ...overrides
  }
}

function run(overrides: Partial<SuiteRun> = {}): SuiteRun {
  return {
    started_at: '2026-08-28T17:32:04.120Z',
    duration_ms: 6200,
    passed: true,
    filter: null,
    branch: null,
    author: null,
    totals: {
      tests: 1,
      passed: 1,
      failed: 0,
      steps: 1
    },
    tests: [{
      id: 'entrar',
      title: 'Entrar',
      spec: 'tests/entrar.spec.ts',
      passed: true,
      duration_ms: 6200,
      steps: 1,
      failed_step: null
    }],
    ...overrides
  }
}

describe('ProjectReportDonut', () => {
  it('pinta as fatias com a paleta de resultado', async () => {
    const wrapper = await mountInApp(ProjectReportDonut, {
      props: {
        title: 'Resultado',
        palette: 'resultado',
        slices: [
          { label: 'Passaram', value: 3 },
          { label: 'Falharam', value: 1 }
        ],
        center: '75%',
        centerLabel: 'passaram',
        testid: 'donut'
      }
    })

    expect(wrapper.findAll('circle')).toHaveLength(3)
    expect(wrapper.html()).toContain('stroke-success')
    expect(wrapper.html()).toContain('stroke-error')
    expect(wrapper.text()).toContain('75%')
    expect(wrapper.text()).toContain('3 · 75%')
  })

  it('sobrevive à rodada sem tempo nenhum e sem número no meio', async () => {
    const wrapper = await mountInApp(ProjectReportDonut, {
      props: {
        title: 'Tempo',
        slices: [{ label: 'Entrar', value: 0 }],
        testid: 'donut'
      }
    })

    expect(wrapper.text()).toContain('0%')
    expect(wrapper.text()).not.toContain('passaram')
  })

  it('repete a paleta quando há mais fatias do que tons', async () => {
    const wrapper = await mountInApp(ProjectReportDonut, {
      props: {
        title: 'Tempo',
        slices: Array.from({ length: 6 }, (_value, index) => ({ label: `Cenário ${index}`, value: 1 })),
        format: (value: number) => `${value}s`,
        testid: 'donut'
      }
    })

    expect(wrapper.text()).toContain('1s · 16,7%')
  })
})

describe('ProjectReportTrend', () => {
  it('centraliza o ponto único no eixo', async () => {
    const wrapper = await mountInApp(ProjectReportTrend, {
      props: {
        title: 'Duração',
        points: [{ label: '28/08', value: 1000, display: '1s' }],
        testid: 'trend'
      }
    })

    expect(wrapper.get('polyline').attributes('points')).toContain('50,')
    expect(wrapper.text()).toContain('28/08 · 1s')
  })

  it('distribui os pontos e mostra a legenda quando ela vem', async () => {
    const wrapper = await mountInApp(ProjectReportTrend, {
      props: {
        title: 'Duração',
        legend: 'segundos por rodada',
        points: [
          { label: '27/08', value: 0, display: '0s' },
          { label: '28/08', value: 2000, display: '2s' }
        ],
        testid: 'trend'
      }
    })

    expect(wrapper.text()).toContain('segundos por rodada')
    expect(wrapper.get('polyline').attributes('points')).toContain('0,')
  })
})

describe('ProjectReportStacked', () => {
  it('empilha falha sobre sucesso e arredonda só o topo', async () => {
    const wrapper = await mountInApp(ProjectReportStacked, {
      props: {
        title: 'Resultado',
        legend: 'verde passou',
        columns: [
          { label: '27/08', passed: 2, failed: 1 },
          { label: '28/08', passed: 3, failed: 0 }
        ],
        testid: 'stacked'
      }
    })

    expect(wrapper.findAll('.bg-error\\/80')).toHaveLength(1)
    expect(wrapper.findAll('.bg-success\\/80')).toHaveLength(2)
    expect(wrapper.text()).toContain('verde passou')
  })

  it('não desenha barra para a rodada que não reportou nada', async () => {
    const wrapper = await mountInApp(ProjectReportStacked, {
      props: {
        title: 'Resultado',
        columns: [{ label: '28/08', passed: 0, failed: 0 }],
        testid: 'stacked'
      }
    })

    expect(wrapper.findAll('.bg-success\\/80')).toHaveLength(0)
    expect(wrapper.findAll('.bg-error\\/80')).toHaveLength(0)
  })
})

describe('ProjectReportMatrix', () => {
  it('marca cada rodada com a cor do resultado', async () => {
    const wrapper = await mountInApp(ProjectReportMatrix, {
      props: {
        stats: [stat({ failures: 1, history: [true, false, null] })]
      }
    })

    const cells = wrapper.findAll('[data-testid="relatorio-matriz-linha"] span.size-4')

    expect(cells[0]!.classes()).toContain('bg-success/70')
    expect(cells[1]!.classes()).toContain('bg-error/70')
    expect(cells[2]!.classes()).toContain('bg-accented')
    expect(wrapper.text()).toContain('1 de 2 falhou')
  })

  it('mostra os cenários que mais falham e diz quantos ficaram de fora', async () => {
    const wrapper = await mountInApp(ProjectReportMatrix, {
      props: {
        stats: Array.from({ length: 20 }, (_value, index) => stat({ id: `cenario-${index}`, title: `Cenário ${index}` })),
        limit: 15
      }
    })

    expect(wrapper.findAll('[data-testid="relatorio-matriz-linha"]')).toHaveLength(15)
    expect(wrapper.text()).toContain('Os 15 cenários que mais falham')
  })

  it('omite a contagem do cenário que nunca falhou', async () => {
    const wrapper = await mountInApp(ProjectReportMatrix, {
      props: {
        stats: [stat()]
      }
    })

    expect(wrapper.text()).not.toContain('falharam')
  })
})

describe('ProjectReportRanking', () => {
  it('avisa quando não há o que ranquear', async () => {
    const wrapper = await mountSuspended(ProjectReportRanking, {
      props: {
        title: 'Mais lentos',
        empty: 'Sem execução para medir.',
        items: [],
        testid: 'ranking'
      }
    })

    expect(wrapper.text()).toContain('Sem execução para medir.')
  })

  it('pinta a barra com o tom de erro quando pedido', async () => {
    const wrapper = await mountSuspended(ProjectReportRanking, {
      props: {
        title: 'Mais falham',
        empty: 'Nada.',
        tone: 'error',
        items: [{ label: 'Entrar', value: 2, display: '2 de 3' }],
        testid: 'ranking'
      }
    })

    expect(wrapper.html()).toContain('bg-error')
  })
})

describe('ProjectReportRuns', () => {
  it('descreve a rodada do projeto inteiro sem filtro nem branch', async () => {
    const wrapper = await mountSuspended(ProjectReportRuns, {
      props: {
        runs: [run()],
        slug: 'alpha-store'
      }
    })

    const item = wrapper.get('[data-testid="relatorio-execucao"]')

    expect(item.text()).toContain('o projeto inteiro')
    expect(item.text()).toContain('1 de 1 passou')
    expect(item.text()).toContain('1 step')
    expect(item.attributes('data-status')).toBe('success')
  })

  it('mostra o filtro e a branch da rodada que os tem', async () => {
    const wrapper = await mountSuspended(ProjectReportRuns, {
      props: {
        runs: [run({
          filter: 'checkout',
          branch: 'main',
          passed: false,
          totals: { tests: 2, passed: 1, failed: 1, steps: 4 }
        })],
        slug: 'alpha-store'
      }
    })

    const item = wrapper.get('[data-testid="relatorio-execucao"]')

    expect(item.text()).toContain('2 cenários filtrados')
    expect(item.text()).toContain('main')
    expect(item.attributes('data-status')).toBe('failed')
  })
})
