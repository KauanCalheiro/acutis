import { describe, expect, it } from 'vitest'
import ScenarioTestRunHistory from '~/components/scenario/test-run/history.vue'
import { mountInApp } from '../../../support/app'
import { settle } from '../../../support/modal'
import type { ScenarioRun } from '~/types/project'

function run(overrides: Partial<ScenarioRun> = {}): ScenarioRun {
  return {
    started_at: '2026-01-01T10:00:00.000Z',
    duration_ms: 4200,
    passed: true,
    branch: 'main',
    author: 'Kauan',
    steps: [{ title: 'abre o login', status: 'success' }],
    ...overrides
  } as ScenarioRun
}

function mount(runs: ScenarioRun[]) {
  return mountInApp(ScenarioTestRunHistory, { props: { runs } })
}

function cards(wrapper: Awaited<ReturnType<typeof mount>>) {
  return wrapper.findAll('[data-testid="cenario-execucao"]')
}

describe('ScenarioTestRunHistory', () => {
  it('convida a rodar o cenário quando nunca rodou', async () => {
    const wrapper = await mount([])

    expect(wrapper.get('[data-testid="cenario-execucoes-vazio"]').text())
      .toContain('Nenhum teste executado ainda')
  })

  it('lista a execução com data, duração e resultado', async () => {
    const wrapper = await mount([run()])

    expect(cards(wrapper)[0]!.attributes('data-status')).toBe('success')
    expect(cards(wrapper)[0]!.text()).toContain('4,2s')
    expect(cards(wrapper)[0]!.text()).toContain('Sucesso')
  })

  it('abre a execução clicada', async () => {
    const wrapper = await mount([run()])

    await cards(wrapper)[0]!.trigger('click')

    expect(wrapper.findComponent(ScenarioTestRunHistory).emitted('open')).toHaveLength(1)
  })

  it('busca pelo step que falhou', async () => {
    const wrapper = await mount([
      run(),
      run({
        started_at: '2026-01-02T10:00:00.000Z',
        passed: false,
        steps: [{ title: 'clica em Entrar', status: 'failed' }]
      } as Partial<ScenarioRun>)
    ])

    await wrapper.get('[data-testid="execucoes-busca"]').setValue('entrar')
    await settle()

    expect(cards(wrapper)).toHaveLength(1)
    expect(cards(wrapper)[0]!.attributes('data-status')).toBe('failed')
  })

  it('avisa quando nada casa com a busca', async () => {
    const wrapper = await mount([run()])

    await wrapper.get('[data-testid="execucoes-busca"]').setValue('não existe')
    await settle()

    expect(wrapper.get('[data-testid="cenario-execucoes-sem-resultado"]').text())
      .toContain('Nenhuma execução encontrada')
  })

  it('filtra por resultado', async () => {
    const wrapper = await mount([run(), run({ started_at: '2026-01-02T10:00:00.000Z', passed: false })])
    const select = wrapper.findAllComponents({ name: 'USelect' }).at(-1)!

    select.vm.$emit('update:modelValue', 'falha')
    await settle()

    expect(cards(wrapper)).toHaveLength(1)
    expect(cards(wrapper)[0]!.attributes('data-status')).toBe('failed')
  })

  it('pagina o histórico de seis em seis e volta à primeira página ao buscar', async () => {
    const many = Array.from({ length: 8 }, (_, index) =>
      run({ started_at: `2026-01-0${index + 1}T10:00:00.000Z` }))
    const wrapper = await mount(many)

    expect(cards(wrapper)).toHaveLength(6)
    expect(wrapper.find('[data-testid="execucoes-paginacao"]').exists()).toBe(true)

    await wrapper.findAll('[data-testid="execucoes-paginacao"] button').at(-1)!.trigger('click')
    await settle()
    expect(cards(wrapper)).toHaveLength(2)

    await wrapper.get('[data-testid="execucoes-busca"]').setValue('Kauan')
    await settle()
    expect(cards(wrapper)).toHaveLength(6)
  })
})
