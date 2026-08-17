import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioTestRunSteps from '~/components/scenario/test-run/steps.vue'

describe('ScenarioTestRunSteps', () => {
  it('não mostra passo nenhum sem execução', async () => {
    const wrapper = await mountSuspended(ScenarioTestRunSteps)

    expect(wrapper.findAll('[data-testid="execucao-step"]')).toHaveLength(0)
  })

  it('mostra cada passo com o estado que a execução reportou', async () => {
    const wrapper = await mountSuspended(ScenarioTestRunSteps, {
      props: {
        steps: [
          { title: 'abre o login', status: 'success' },
          { title: 'entra', status: 'running' },
          { title: 'confere o painel', status: 'waiting' }
        ]
      }
    })

    const steps = wrapper.findAll('[data-testid="execucao-step"]')

    expect(steps.map(step => step.attributes('data-status'))).toEqual(['success', 'running', 'waiting'])
    expect(steps[0]!.get('[data-testid="execucao-step-titulo"]').text()).toBe('abre o login')
  })

  it('explica o erro do passo que falhou', async () => {
    const wrapper = await mountSuspended(ScenarioTestRunSteps, {
      props: {
        steps: [
          { title: 'entra', status: 'failed', error: 'locator não encontrado' },
          { title: 'sai', status: 'failed' }
        ]
      }
    })

    const errors = wrapper.findAll('[data-testid="execucao-step-erro"]')

    expect(errors).toHaveLength(1)
    expect(errors[0]!.text()).toContain('locator não encontrado')
  })
})
