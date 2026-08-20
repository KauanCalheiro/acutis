import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioWarnings from '~/components/scenario/warnings.vue'

describe('ScenarioWarnings', () => {
  it('some quando a geração não teve ressalva', async () => {
    const wrapper = await mountSuspended(ScenarioWarnings, { props: { slug: 'alpha-store' } })

    expect(wrapper.find('[data-testid="geracao-ressalvas"]').exists()).toBe(false)
  })

  it('lista a ressalva sem o slug da regra', async () => {
    const wrapper = await mountSuspended(ScenarioWarnings, {
      props: { slug: 'alpha-store', warnings: ['selector-frageis: o seletor depende da posição'] }
    })

    expect(wrapper.get('li').text()).toBe('o seletor depende da posição')
    expect(wrapper.find('[data-testid="ressalvas-ambiente"]').exists()).toBe(false)
  })

  it('leva ao ambiente quando falta valor de variável', async () => {
    const wrapper = await mountSuspended(ScenarioWarnings, {
      props: { slug: 'alpha-store', warnings: ['env-sem-valor: SENHA está vazia'] }
    })

    expect(wrapper.get('[data-testid="ressalvas-ambiente"]').attributes('href'))
      .toBe('/projects/alpha-store?environment')
  })
})
