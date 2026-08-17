import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseCodefield from '~/components/base/codefield.vue'

describe('BaseCodefield', () => {
  it('renderiza os tokens sem interpretar o código como HTML', async () => {
    const wrapper = await mountSuspended(BaseCodefield, {
      props: {
        language: 'typescript',
        modelValue: 'const tag = "<script>alert(1)</script>"'
      }
    })

    expect(wrapper.get('code .token.keyword').text()).toBe('const')
    expect(wrapper.find('code script').exists()).toBe(false)
    expect(wrapper.get('code').text()).toContain('<script>alert(1)</script>')
  })
})
