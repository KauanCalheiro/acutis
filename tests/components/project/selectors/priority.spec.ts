import { beforeEach, describe, expect, it } from 'vitest'
import { mountSuspended, mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ProjectSelectorsPriority from '~/components/project/selectors/priority.vue'

const toasts: Array<{ title: string, color: string }> = []

mockNuxtImport('useToast', () => () => ({ add: (toast: { title: string, color: string }) => toasts.push(toast) }))

const api = { status: 200, saved: null as { selectors?: string[] } | null }

registerEndpoint('/api/projects/alpha-store/selectors', {
  method: 'PUT',
  handler: async (event) => {
    api.saved = await readBody(event)
    if (api.status !== 200) throw createError({ statusCode: api.status, data: { message: 'Projeto sumiu' } })

    return { selectors: api.saved!.selectors }
  }
})

const ORDER = ['dataTestId', 'dataCy', 'ariaLabel', 'placeholder', 'cssStable', 'id', 'text', 'finder', 'xpath']

function mount(selectors = ORDER) {
  return mountSuspended(ProjectSelectorsPriority, { props: { slug: 'alpha-store', selectors } })
}

/** O arrasto do card `from` até a posição do card `to`, como o navegador o entrega. */
async function drag(wrapper: Awaited<ReturnType<typeof mount>>, from: number, to: number) {
  const cards = wrapper.findAll('[data-testid^="seletores-item-"]')

  await cards[from]!.trigger('dragstart')
  await cards[to]!.trigger('dragenter')
  await wrapper.findAll('[data-testid^="seletores-item-"]')[to]!.trigger('drop')
}

async function flush(): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, 0))
}

function keys(wrapper: Awaited<ReturnType<typeof mount>>): string[] {
  return wrapper.findAll('[data-testid^="seletores-item-"]')
    .map(card => card.attributes('data-key')!)
}

beforeEach(() => {
  toasts.length = 0
  api.status = 200
  api.saved = null
})

describe('ProjectSelectorsPriority', () => {
  it('mostra um card por seletor, na ordem que o projeto guarda', async () => {
    const wrapper = await mount()

    expect(keys(wrapper)).toEqual(ORDER)
    expect(wrapper.text()).toContain('data-testid')
    expect(wrapper.text()).toContain('XPath')
  })

  it('mostra um exemplo do seletor junto da descrição de cada card', async () => {
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="seletores-exemplo-0"]').text()).toBe('[data-testid="login-entrar"]')
    expect(wrapper.findAll('[data-testid^="seletores-exemplo-"]')).toHaveLength(ORDER.length)
  })

  it('dá a cada seletor o exemplo da forma que ele toma, e não um exemplo só', async () => {
    const wrapper = await mount()

    const exemplos = wrapper.findAll('[data-testid^="seletores-exemplo-"]').map(item => item.text())

    expect(new Set(exemplos).size).toBe(ORDER.length)
    expect(exemplos.at(-1)).toContain('/html')
  })

  it('marca o card que está na mão do usuário, e só ele', async () => {
    const wrapper = await mount()
    const cards = wrapper.findAll('[data-testid^="seletores-item-"]')

    await cards[3]!.trigger('dragstart')

    const marcados = wrapper.findAll('[data-testid^="seletores-item-"]')
      .map(card => card.attributes('data-dragging'))

    expect(marcados[3]).toBe('true')
    expect(marcados.filter(value => value === 'true')).toHaveLength(1)
  })

  it('solta a marca do card quando o arrasto termina', async () => {
    const wrapper = await mount()
    const cards = wrapper.findAll('[data-testid^="seletores-item-"]')

    await cards[3]!.trigger('dragstart')
    await cards[3]!.trigger('dragend')

    expect(wrapper.findAll('[data-dragging="true"]')).toHaveLength(0)
  })

  it('numera os cards para a posição ficar visível sem contar na mão', async () => {
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="seletores-item-0"]').text()).toContain('1')
  })

  it('reordena ao arrastar um card para cima', async () => {
    const wrapper = await mount()

    await drag(wrapper, 8, 0)

    expect(keys(wrapper)[0]).toBe('xpath')
    expect(keys(wrapper)).toHaveLength(ORDER.length)
  })

  it('reordena ao arrastar um card para baixo, sem duplicar nem sumir com nenhum', async () => {
    const wrapper = await mount()

    await drag(wrapper, 0, 3)

    expect(keys(wrapper)[3]).toBe('dataTestId')
    expect([...keys(wrapper)].sort()).toEqual([...ORDER].sort())
  })

  it('não mexe em nada quando o card é solto onde já estava', async () => {
    const wrapper = await mount()

    await drag(wrapper, 2, 2)

    expect(keys(wrapper)).toEqual(ORDER)
  })

  it('salva sozinho assim que o arrasto termina, sem botão nenhum', async () => {
    const wrapper = await mount()

    await drag(wrapper, 8, 0)
    await flush()

    expect(api.saved!.selectors![0]).toBe('xpath')
    expect(api.saved!.selectors).toHaveLength(ORDER.length)
    expect(toasts.at(-1)).toMatchObject({ color: 'success' })
  })

  it('não chama o servidor quando o card volta para onde estava', async () => {
    const wrapper = await mount()

    await drag(wrapper, 2, 2)
    await flush()

    expect(api.saved).toBeNull()
  })

  it('devolve a ordem ao que o servidor tem quando o salvamento falha', async () => {
    api.status = 404
    const wrapper = await mount()

    await drag(wrapper, 8, 0)
    await flush()

    expect(toasts.at(-1)).toMatchObject({ color: 'error' })
    expect(toasts.at(-1)!.title).toContain('Projeto sumiu')
    expect(keys(wrapper)).toEqual(ORDER)
  })

  it('não oferece restaurar enquanto a ordem é a padrão', async () => {
    const wrapper = await mount()

    expect(wrapper.find('[data-testid="seletores-restaurar"]').exists()).toBe(false)
  })

  it('oferece restaurar assim que a ordem sai do padrão', async () => {
    const wrapper = await mount()

    await drag(wrapper, 8, 0)
    await flush()

    expect(wrapper.find('[data-testid="seletores-restaurar"]').exists()).toBe(true)
  })

  it('pede confirmação antes de restaurar, sem mexer em nada no primeiro clique', async () => {
    const wrapper = await mount(['xpath', ...ORDER.filter(key => key !== 'xpath')])

    await wrapper.get('[data-testid="seletores-restaurar"]').trigger('click')
    await flush()

    expect(wrapper.get('[data-testid="seletores-restaurar"]').text()).toContain('Confirmar')
    expect(api.saved).toBeNull()
    expect(keys(wrapper)[0]).toBe('xpath')
  })

  it('restaura a ordem padrão e a salva no segundo clique', async () => {
    const wrapper = await mount(['xpath', ...ORDER.filter(key => key !== 'xpath')])

    await wrapper.get('[data-testid="seletores-restaurar"]').trigger('click')
    await wrapper.get('[data-testid="seletores-restaurar"]').trigger('click')
    await flush()

    expect(keys(wrapper)).toEqual(ORDER)
    expect(api.saved!.selectors).toEqual(ORDER)
    expect(wrapper.find('[data-testid="seletores-restaurar"]').exists()).toBe(false)
  })
})
