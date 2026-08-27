import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioTestRunFailure from '~/components/scenario/test-run/failure.vue'

const NOT_FOUND = [
  'Error: expect(locator).toBeVisible() failed',
  '',
  'Locator: getByTestId(\'calendar-event-save\')',
  'Expected: visible',
  'Timeout: 15000ms',
  'Error: element(s) not found'
].join('\n')

describe('ScenarioTestRunFailure', () => {
  it('diz o que falhou em português, e o que fazer a respeito', async () => {
    const wrapper = await mountSuspended(ScenarioTestRunFailure, { props: { error: NOT_FOUND } })

    expect(wrapper.get('[data-testid="execucao-step-erro"]').text())
      .toContain('Não achei calendar-event-save na página depois de 15s.')
    expect(wrapper.get('[data-testid="execucao-step-dica"]').text()).toContain('Regravar o passo')
  })

  it('guarda a mensagem crua do Playwright para quem for depurar', async () => {
    const wrapper = await mountSuspended(ScenarioTestRunFailure, { props: { error: NOT_FOUND } })

    expect(wrapper.get('[data-testid="execucao-step-erro-cru"]').text()).toContain('expect(locator).toBeVisible()')
  })

  it('não abre espaço de dica para o erro que ela não conhece', async () => {
    const wrapper = await mountSuspended(ScenarioTestRunFailure, { props: { error: 'Error: algo exótico' } })

    expect(wrapper.get('[data-testid="execucao-step-erro"]').text()).toContain('algo exótico')
    expect(wrapper.find('[data-testid="execucao-step-dica"]').exists()).toBe(false)
  })
})
