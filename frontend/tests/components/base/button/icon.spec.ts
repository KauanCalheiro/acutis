import { describe, expect, it } from 'vitest'
import BaseButtonIcon from '~/components/base/button/icon.vue'
import { mountInApp } from '../../../support/app'

describe('BaseButtonIcon', () => {
  it('usa o rótulo como nome acessível do botão', async () => {
    const wrapper = await mountInApp(BaseButtonIcon, {
      props: { icon: 'i-ic-round-delete', label: 'Excluir projeto' }
    })

    expect(wrapper.get('button').attributes('aria-label')).toBe('Excluir projeto')
  })

  it('repassa os atributos soltos para o botão, não para o tooltip', async () => {
    const wrapper = await mountInApp(BaseButtonIcon, {
      props: { icon: 'i-ic-round-delete', label: 'Excluir', side: 'right' },
      attrs: { 'data-testid': 'excluir', 'disabled': true }
    })

    expect(wrapper.get('button').attributes('data-testid')).toBe('excluir')
    expect(wrapper.get('button').attributes('disabled')).toBeDefined()
  })
})
