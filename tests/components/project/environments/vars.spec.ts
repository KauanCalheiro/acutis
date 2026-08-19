import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import ProjectEnvironmentsVars from '~/components/project/environments/vars.vue'
import { mountInApp } from '../../../support/app'
import type { EditableVar } from '~/types/project'

function vars(...list: Partial<EditableVar>[]): EditableVar[] {
  return reactive(list.map(item => ({ key: 'BASE_URL', value: 'https://loja.test', secret: false, pending: false, ...item })))
}

function mount(modelValue: EditableVar[], props: Record<string, unknown> = {}) {
  return mountInApp(ProjectEnvironmentsVars, { props: { modelValue, ...props } })
}

describe('ProjectEnvironmentsVars', () => {
  it('avisa quando não há variável nenhuma', async () => {
    const wrapper = await mount([])

    expect(wrapper.text()).toContain('Nenhuma variável ainda.')
  })

  it('adiciona uma variável vazia', async () => {
    const wrapper = await mount([])

    await wrapper.get('[data-testid="variaveis-adicionar"]').trigger('click')

    expect(wrapper.findComponent(ProjectEnvironmentsVars).emitted('update:modelValue')!.at(-1))
      .toEqual([[{ key: '', value: '', secret: false, pending: false }]])
  })

  it('remove a variável escolhida', async () => {
    const wrapper = await mount(vars({ key: 'BASE_URL' }, { key: 'SENHA' }))

    await wrapper.get('[data-testid="variaveis-remover-0"]').trigger('click')
    const emitted = wrapper.findComponent(ProjectEnvironmentsVars).emitted('update:modelValue')!.at(-1) as [EditableVar[]]

    expect(emitted[0].map(variable => variable.key)).toEqual(['SENHA'])
  })

  it('mascara o segredo até revelarem', async () => {
    const wrapper = await mount(vars({ key: 'SENHA', secret: true }))

    expect(wrapper.get('[data-testid="variaveis-valor-0"]').attributes('type')).toBe('password')

    await wrapper.get('[data-testid="variaveis-revelar-0"]').trigger('click')
    expect(wrapper.get('[data-testid="variaveis-valor-0"]').attributes('type')).toBe('text')

    await wrapper.get('[data-testid="variaveis-revelar-0"]').trigger('click')
    expect(wrapper.get('[data-testid="variaveis-valor-0"]').attributes('type')).toBe('password')
  })

  it('marca e desmarca a variável como segredo', async () => {
    const list = vars({ key: 'SENHA' })
    const wrapper = await mount(list)

    await wrapper.get('[data-testid="variaveis-segredo-0"]').trigger('click')
    expect(list[0]!.secret).toBe(true)

    await wrapper.get('[data-testid="variaveis-segredo-0"]').trigger('click')
    expect(list[0]!.secret).toBe(false)
  })

  it('guarda a chave e o valor digitados na variável', async () => {
    const list = vars({ key: 'BASE_URL', value: 'https://loja.test' })
    const wrapper = await mount(list)

    await wrapper.get('[data-testid="variaveis-chave-0"]').setValue('URL')
    await wrapper.get('[data-testid="variaveis-valor-0"]').setValue('https://outra.test')

    expect(list[0]).toMatchObject({ key: 'URL', value: 'https://outra.test' })
  })

  it('sugere as chaves conhecidas e aceita o testid da tela', async () => {
    const wrapper = await mount(vars({}), { knownKeys: ['BASE_URL', 'SENHA'], testid: 'auth-vars' })

    expect(wrapper.findAll('datalist option').map(option => option.attributes('value')))
      .toEqual(['BASE_URL', 'SENHA'])
    expect(wrapper.find('[data-testid="auth-vars-chave-0"]').exists()).toBe(true)
  })
})
