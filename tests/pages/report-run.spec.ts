import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { defineComponent, h } from 'vue'
import { UApp } from '#components'
import ReportRunPage from '~/pages/projects/[projectSlug]/report/[run].vue'
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

const LAST = '2026-08-28T17:32:04.120Z'
const PREVIOUS = '2026-08-27T11:04:00.000Z'

const comprar = (overrides: Partial<SuiteRunTest> = {}) => test({
  id: 'comprar',
  title: 'Comprar',
  spec: 'tests/comprar.spec.ts',
  duration_ms: 5300,
  steps: 6,
  ...overrides
})

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
    run(LAST, [test({ duration_ms: 900 }), comprar({ passed: false, failed_step: 'Pagar' })], 'checkout'),
    run(PREVIOUS, [test({ duration_ms: 800 }), comprar({ duration_ms: 4000 })])
  ]
})

afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function mount(startedAt = LAST) {
  const host = defineComponent({
    setup() {
      return () => h(UApp, null, { default: () => h(ReportRunPage) })
    }
  })

  const wrapper = await mountSuspended(host, {
    route: `/projects/alpha-store/report/${Date.parse(startedAt)}`
  })
  mounted = wrapper

  await settle()

  return wrapper
}

function metric(wrapper: Awaited<ReturnType<typeof mount>>, name: string) {
  return wrapper.get(`[data-metrica="${name}"]`).text()
}

describe('ReportRunPage', () => {
  it('identifica a execução com status, filtro, branch e autor', async () => {
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="execucao-titulo"]').text()).toContain('28/08/2026')
    expect(wrapper.get('[data-testid="execucao-contexto"]').text()).toContain('filtro com 2 cenários')
    expect(wrapper.findAllComponents({ name: 'UTooltip' }).map(tooltip => tooltip.props('text'))).toContain('checkout')
    expect(wrapper.get('[data-testid="execucao-contexto"]').text()).toContain('main')
    expect(wrapper.get('[data-testid="execucao-contexto"]').text()).toContain('Kauan')
  })

  it('mostra as métricas da rodada', async () => {
    const wrapper = await mount()

    expect(metric(wrapper, 'cenarios')).toContain('1/2')
    expect(metric(wrapper, 'sucesso')).toContain('50%')
    expect(metric(wrapper, 'duracao')).toContain('6,2s')
    expect(metric(wrapper, 'steps')).toContain('10')
    expect(metric(wrapper, 'mais-lento')).toContain('Comprar')
  })

  it('desenha a proporção de resultados e a fatia do tempo de cada cenário', async () => {
    const wrapper = await mount()
    const resultado = wrapper.getComponent('[data-testid="execucao-donut-resultado"]')
    const tempo = wrapper.getComponent('[data-testid="execucao-donut-tempo"]')

    expect(resultado.props('slices')).toEqual([
      { label: 'Passaram', value: 1 },
      { label: 'Falharam', value: 1 }
    ])
    expect((tempo.props('slices') as { label: string, value: number }[])[0])
      .toEqual({ label: 'Comprar', value: 5300 })
  })

  it('destaca o que quebrou com link para a execução do cenário', async () => {
    const wrapper = await mount()
    const broken = wrapper.findAll('[data-testid="execucao-quebrou"]')

    expect(broken).toHaveLength(1)
    expect(broken[0]!.text()).toContain('Comprar')
    expect(broken[0]!.text()).toContain('Pagar')
    expect(broken[0]!.get('a').attributes('href'))
      .toBe(`/projects/alpha-store/scenarios/comprar?tab=execucoes&run=${encodeURIComponent(LAST)}`)
  })

  it('agrupa o resto dos cenários numa fatia só e anota quem entrou e saiu', async () => {
    const many = Array.from({ length: 7 }, (_value, index) => test({
      id: `cenario-${index}`,
      title: `Cenário ${index}`,
      duration_ms: 1000 * (index + 1)
    }))

    api.runs = [
      run(LAST, many),
      run(PREVIOUS, [test({ id: 'cenario-0', title: 'Cenário 0' }), test({ id: 'saiu', title: 'Saiu da rodada' })])
    ]

    const wrapper = await mount()
    const slices = wrapper.getComponent('[data-testid="execucao-donut-tempo"]').props('slices') as { label: string }[]
    const comparison = wrapper.get('[data-testid="execucao-comparacao"]').text()

    expect(slices).toHaveLength(5)
    expect(slices.at(-1)!.label).toBe('outros 3 cenários')
    expect(comparison).toContain('Saiu da rodada')
    expect(comparison).toContain('ficou de fora desta rodada')
    expect(comparison).toContain('não estava na rodada anterior')
  })

  it('compara a rodada com a anterior', async () => {
    const wrapper = await mount()
    const comparison = wrapper.get('[data-testid="execucao-comparacao"]').text()

    expect(comparison).toContain('Comprar')
    expect(comparison).toContain('4,8s')
  })

  it('lista todos os cenários com a fatia do tempo que cada um levou', async () => {
    const wrapper = await mount()
    const rows = wrapper.findAll('[data-testid="execucao-teste"]')

    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Comprar')
    expect(rows[0]!.text()).toContain('85,5%')
  })

  it('só oferece o relatório do Playwright na execução mais recente', async () => {
    const recent = await mount()

    expect(recent.get('[data-testid="execucao-playwright"]').attributes('href'))
      .toBe('/api/projects/alpha-store/report/')

    recent.unmount()

    const old = await mount(PREVIOUS)

    expect(old.find('[data-testid="execucao-playwright"]').exists()).toBe(false)
  })

  it('avisa quando a execução não está mais guardada', async () => {
    api.runs = []
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="execucao-inexistente"]').text()).toContain('não está mais')
  })
})
