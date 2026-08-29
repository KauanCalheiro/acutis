import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { defineComponent, h } from 'vue'
import { UApp } from '#components'
import ReportPage from '~/pages/projects/[projectSlug]/report/index.vue'
import { settle } from '../support/modal'
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

function run(startedAt: string, tests: SuiteRunTest[], filter: string | null = null): SuiteRun {
  return {
    started_at: startedAt,
    duration_ms: tests.reduce((total, item) => total + item.duration_ms, 0),
    passed: tests.every(item => item.passed),
    filter,
    branch: 'main',
    author: 'Kauan',
    totals: {
      tests: tests.length,
      passed: tests.filter(item => item.passed).length,
      failed: tests.filter(item => !item.passed).length,
      steps: tests.reduce((total, item) => total + item.steps, 0)
    },
    tests
  }
}

const api = { runs: [] as SuiteRun[] }

registerEndpoint('/api/projects/alpha-store', () => ({
  name: 'Alpha Store',
  slug: 'alpha-store',
  path: '/home/user/.acutis/alpha-store',
  repository: null,
  provider: null,
  created_at: '2026-01-01T00:00:00+00:00',
  branch: 'main',
  updated_at: '2026-01-02T10:00:00+00:00',
  scenarios: [],
  auth_status: 'configured',
  base_url: 'https://loja.test',
  storage_state: '/tmp/storage-state.json',
  requires_url: false,
  vscode_url: 'vscode://file/home/user/.acutis/alpha-store',
  has_report: true
}))

registerEndpoint('/api/projects/alpha-store/runs', () => ({ runs: api.runs }))

let mounted: { unmount: () => void } | undefined

beforeEach(() => {
  clearNuxtData()
  api.runs = [
    run('2026-08-28T17:32:04.120Z', [
      test({ duration_ms: 900 }),
      test({ id: 'comprar', title: 'Comprar', spec: 'tests/comprar.spec.ts', passed: false, duration_ms: 5300, steps: 6, failed_step: 'Pagar' })
    ], 'checkout'),
    run('2026-08-27T11:04:00.000Z', [test({ duration_ms: 800 }), test({ id: 'comprar', title: 'Comprar', spec: 'tests/comprar.spec.ts', duration_ms: 4000, steps: 6 })])
  ]
})

afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function mount() {
  const host = defineComponent({
    setup() {
      return () => h(UApp, null, { default: () => h(ReportPage) })
    }
  })

  const wrapper = await mountSuspended(host, { route: '/projects/alpha-store/report' })
  mounted = wrapper

  await settle()

  return wrapper
}

function metric(wrapper: Awaited<ReturnType<typeof mount>>, name: string) {
  return wrapper.get(`[data-metrica="${name}"]`).text()
}

describe('ReportPage', () => {
  it('mostra as métricas das rodadas', async () => {
    const wrapper = await mount()

    expect(metric(wrapper, 'ultima')).toContain('1/2')
    expect(metric(wrapper, 'sucesso-rodadas')).toContain('50%')
    expect(metric(wrapper, 'sucesso-cenarios')).toContain('75%')
    expect(metric(wrapper, 'sucesso-cenarios')).toContain('20 steps · 5 por cenário')
    expect(metric(wrapper, 'duracao')).toContain('5,5s')
    expect(metric(wrapper, 'instaveis')).toContain('1')
  })

  it('resume a rodada sem despejar o filtro inteiro na linha', async () => {
    const wrapper = await mount()
    const first = wrapper.findAll('[data-testid="relatorio-execucao"]')[0]!

    expect(first.text()).toContain('filtrado')
    expect(first.text()).not.toContain('checkout')
  })

  it('leva para a página daquela execução', async () => {
    const wrapper = await mount()

    expect(wrapper.findAll('[data-testid="relatorio-execucao"]')[0]!.attributes('href'))
      .toBe(`/projects/alpha-store/report/${Date.parse('2026-08-28T17:32:04.120Z')}`)
  })

  it('lista as rodadas da mais recente para a mais antiga', async () => {
    const wrapper = await mount()
    const runs = wrapper.findAll('[data-testid="relatorio-execucao"]')

    expect(runs).toHaveLength(2)
    expect(runs[0]!.attributes('data-status')).toBe('failed')
    expect(runs[0]!.text()).toContain('1 de 2 passou')
    expect(runs[1]!.text()).toContain('2 de 2 passaram')
    expect(runs[1]!.attributes('data-status')).toBe('success')
  })

  it('leva ao relatório do Playwright da última execução', async () => {
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="relatorio-playwright"]').attributes('href'))
      .toBe('/api/projects/alpha-store/report/')
  })

  it('recorta os gráficos e pagina a lista quando o histórico é grande', async () => {
    api.runs = Array.from({ length: 40 }, (_value, index) => run(
      new Date(Date.parse('2026-08-01T09:00:00.000Z') + index * 3600_000).toISOString(),
      [test({ passed: index % 3 !== 0 })]
    )).reverse()

    const wrapper = await mount()

    expect(wrapper.getComponent('[data-testid="relatorio-resultado"]').props('columns')).toHaveLength(30)
    expect(wrapper.getComponent('[data-testid="relatorio-duracao"]').props('points')).toHaveLength(30)
    expect(wrapper.getComponent('[data-testid="relatorio-matriz"]').props('rounds')).toBe(30)
    expect(wrapper.findAll('[data-testid="relatorio-execucao"]')).toHaveLength(10)
    expect(wrapper.find('[data-testid="relatorio-paginacao"]').exists()).toBe(true)
  })

  it('mostra o ranking dos cenários que mais falham', async () => {
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="relatorio-ranking-falhas"]').text()).toContain('Comprar')
  })

  it('convida a rodar quando o projeto nunca teve execução agrupada', async () => {
    api.runs = []
    const wrapper = await mount()

    expect(wrapper.find('[data-testid="relatorio-vazio"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="relatorio-execucao"]').exists()).toBe(false)
  })
})
