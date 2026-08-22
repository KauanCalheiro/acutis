// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PillIcon from '../PillIcon.vue'

const names = [
  'pause',
  'resume',
  'assert',
  'hover',
  'stop',
  'cancel',
  'exists',
  'visible',
  'hidden',
  'checked',
  'disabled',
  'text',
  'value',
  'contains',
  'url'
] as const

describe('PillIcon', () => {
  it.each(names)('renderiza o ícone %s como SVG declarativo', (name) => {
    const wrapper = mount(PillIcon, {
      props: {
        name,
        size: 16
      }
    })

    expect(wrapper.element.tagName).toBe('svg')
    expect(wrapper.attributes()).toMatchObject({
      'width': '16',
      'height': '16',
      'aria-hidden': 'true'
    })
    expect(wrapper.element.children.length).toBeGreaterThan(0)
  })
})
