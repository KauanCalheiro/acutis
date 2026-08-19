import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioReviewLoading from '~/components/scenario/review/loading.vue'
import ScenarioSuggestionsLoading from '~/components/scenario/suggestions/loading.vue'

describe('as esperas da IA', () => {
  it('conta o que a revisão está fazendo', async () => {
    const wrapper = await mountSuspended(ScenarioReviewLoading)

    expect(wrapper.text()).toContain('Analisando os elementos da tela')
  })

  it('conta o que as sugestões estão fazendo', async () => {
    const wrapper = await mountSuspended(ScenarioSuggestionsLoading)

    expect(wrapper.text()).toContain('Analisando os eventos gravados')
  })
})
