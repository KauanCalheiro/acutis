import { describe, expect, it } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import BaseCodefield from '~/components/base/codefield.vue'

describe('BaseCodefield: tabulação', () => {
  it('indenta com dois espaços em vez de sair do campo', async () => {
    const wrapper = await mountSuspended(BaseCodefield, {
      props: { language: 'typescript', modelValue: 'test()', testid: 'codigo' }
    })
    const textarea = wrapper.get('[data-testid="codigo"]')
    const element = textarea.element as HTMLTextAreaElement

    element.setSelectionRange(0, 0)
    await textarea.trigger('keydown.tab')

    expect(wrapper.emitted('update:modelValue')!.at(-1)).toEqual(['  test()'])
  })

  it('cresce junto com o conteúdo digitado', async () => {
    const wrapper = await mountSuspended(BaseCodefield, {
      props: { language: 'gherkin', modelValue: 'Funcionalidade: Login', testid: 'codigo' }
    })

    await wrapper.get('[data-testid="codigo"]').setValue('Funcionalidade: Login\n  Cenário: entra')

    expect((wrapper.get('[data-testid="codigo"]').element as HTMLTextAreaElement).style.height)
      .not.toBe('')
  })
})
