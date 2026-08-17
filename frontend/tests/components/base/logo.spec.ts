import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseLogo from '~/components/base/logo.vue'
import { logoPath } from '~/utils/logo'

describe('BaseLogo', () => {
  it('desenha o traçado da marca herdando a cor do texto', async () => {
    const wrapper = await mountSuspended(BaseLogo)

    expect(wrapper.get('path').attributes('d')).toBe(logoPath)
    expect(wrapper.get('svg').attributes('stroke')).toBe('currentColor')
  })
})
