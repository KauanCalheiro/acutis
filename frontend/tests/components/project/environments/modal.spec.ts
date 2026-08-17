import { beforeEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ProjectEnvironmentsModal from '~/components/project/environments/modal.vue'
import { field, openModal, settle, type } from '../../../support/modal'
import type { EnvironmentList } from '~/types/project'

const toasts: Array<{ title: string, color: string }> = []

mockNuxtImport('useToast', () => () => ({ add: (toast: { title: string, color: string }) => toasts.push(toast) }))

function environment(slug: string, name: string) {
  return {
    slug,
    name,
    vars: [
      { key: 'BASE_URL', value: 'https://loja.test', secret: false, pending: false },
      { key: 'SENHA', value: null, secret: true, pending: true }
    ]
  }
}

const api = {
  list: {
    active: 'homologacao',
    known_keys: ['BASE_URL', 'SENHA'],
    environments: [environment('desenvolvimento', 'Desenvolvimento'), environment('homologacao', 'Homologação')]
  } as unknown as EnvironmentList,
  listStatus: 200,
  writeStatus: 200,
  saved: null as unknown,
  created: null as unknown,
  removed: null as string | null
}

registerEndpoint('/api/projects/alpha-store/environments', {
  method: 'GET',
  handler: () => {
    if (api.listStatus !== 200) throw createError({ statusCode: api.listStatus, data: { message: 'Pasta sumiu' } })

    return api.list
  }
})

registerEndpoint('/api/projects/alpha-store/environments', {
  method: 'POST',
  handler: async (event) => {
    api.created = await readBody(event)
    if (api.writeStatus !== 200) throw createError({ statusCode: api.writeStatus, data: { message: 'Nome repetido' } })

    return environment('producao', 'Produção')
  }
})

registerEndpoint('/api/projects/alpha-store/environments/homologacao', {
  method: 'PUT',
  handler: async (event) => {
    api.saved = await readBody(event)
    if (api.writeStatus !== 200) throw createError({ statusCode: api.writeStatus, data: { message: 'Variável sem chave' } })

    return { ok: true }
  }
})

registerEndpoint('/api/projects/alpha-store/environments/homologacao', {
  method: 'DELETE',
  handler: () => {
    api.removed = 'homologacao'
    if (api.writeStatus !== 200) throw createError({ statusCode: api.writeStatus, data: { message: 'Ambiente em uso' } })

    return { ok: true }
  }
})

beforeEach(() => {
  toasts.length = 0
  api.listStatus = 200
  api.writeStatus = 200
  api.saved = null
  api.created = null
  api.removed = null
  api.list = {
    active: 'homologacao',
    known_keys: ['BASE_URL', 'SENHA'],
    environments: [environment('desenvolvimento', 'Desenvolvimento'), environment('homologacao', 'Homologação')]
  } as unknown as EnvironmentList
})

function open() {
  return openModal(ProjectEnvironmentsModal, { slug: 'alpha-store' })
}

describe('ProjectEnvironmentsModal', () => {
  it('abre no ambiente ativo, com as variáveis dele', async () => {
    await open()

    expect((field('ambientes-nome') as HTMLInputElement).value).toBe('Homologação')
    expect((field('ambientes-variaveis-chave-0') as HTMLInputElement).value).toBe('BASE_URL')
    expect(field('ambientes-variaveis-valor-1')!.getAttribute('type')).toBe('password')
  })

  it('troca para o ambiente escolhido', async () => {
    await open()

    field('ambientes-selecionar-desenvolvimento')!.click()
    await settle()

    expect((field('ambientes-nome') as HTMLInputElement).value).toBe('Desenvolvimento')
  })

  it('avisa quando a lista não carrega', async () => {
    api.listStatus = 500

    await open()

    expect(toasts.at(-1)!.title).toBe('Pasta sumiu')
  })

  it('convida a criar o primeiro ambiente quando não há nenhum', async () => {
    api.list = { active: null, known_keys: [], environments: [] } as unknown as EnvironmentList

    await open()

    expect(field('ambientes-vazio')!.textContent).toContain('Nenhum ambiente ainda')
  })

  it('cria um ambiente pelo nome digitado', async () => {
    const { events } = await open()

    field('ambientes-criar')!.click()
    await settle()
    await type('ambientes-novo-nome', 'Produção')
    field('ambientes-criar')!.click()
    await settle()

    expect(api.created).toEqual({ name: 'Produção' })
    expect(toasts.at(-1)).toMatchObject({ title: 'Ambiente criado', color: 'success' })
    expect(events.saved).toHaveLength(1)
  })

  it('não cria ambiente sem nome', async () => {
    await open()

    field('ambientes-criar')!.click()
    await settle()
    await type('ambientes-novo-nome', '   ')
    field('ambientes-novo-nome')!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', bubbles: true }))
    await settle()

    expect(api.created).toBeNull()
  })

  it('salva o ambiente com o valor vazio virando nulo', async () => {
    const { events } = await open()

    await type('ambientes-nome', 'Homologação 2')
    field('ambientes-salvar')!.click()
    await settle()

    expect(api.saved).toEqual({
      name: 'Homologação 2',
      vars: [
        { key: 'BASE_URL', value: 'https://loja.test', secret: false },
        { key: 'SENHA', value: null, secret: true }
      ]
    })
    expect(events.saved).toHaveLength(1)
    expect(toasts.at(-1)).toMatchObject({ title: 'Ambiente salvo' })
  })

  it('avisa quando o ambiente não salva', async () => {
    await open()
    api.writeStatus = 422

    await type('ambientes-nome', 'Homologação 2')
    field('ambientes-salvar')!.click()
    await settle()

    expect(toasts.at(-1)).toMatchObject({ title: 'Variável sem chave', color: 'error' })
  })

  it('reverte a edição para o que estava gravado', async () => {
    await open()

    await type('ambientes-nome', 'Outro nome')
    await settle()
    field('ambientes-reverter')!.click()
    await settle(6)

    expect((field('ambientes-nome') as HTMLInputElement).value).toBe('Homologação')
    expect(field('ambientes-reverter')).toBeUndefined()
  })

  it('remove o ambiente só depois de confirmar', async () => {
    await open()

    field('ambientes-remover')!.click()
    await settle()
    expect(api.removed).toBeNull()
    expect(field('ambientes-remover')!.textContent).toContain('Confirmar remoção')

    field('ambientes-remover')!.click()
    await settle()

    expect(api.removed).toBe('homologacao')
    expect(toasts.at(-1)).toMatchObject({ title: 'Ambiente removido' })
  })

  it('desiste da remoção quando o clique vai para outro lugar', async () => {
    await open()

    field('ambientes-remover')!.click()
    await settle()
    field('ambientes-nome')!.click()
    await settle()

    expect(field('ambientes-remover')!.textContent).toContain('Remover')
    expect(field('ambientes-remover')!.textContent).not.toContain('Confirmar')
  })

  it('avisa das alterações não salvas antes de fechar', async () => {
    const { state } = await open()

    await type('ambientes-nome', 'Outro nome')
    field('ambientes-fechar')!.click()
    await settle()

    expect(state.value).toBe(true)
    expect(field('ambientes-fechar-aviso')!.textContent).toContain('alterações não salvas')

    field('ambientes-fechar')!.click()
    await settle()

    expect(state.value).toBe(false)
  })

  it('desiste de criar o ambiente pelo esc', async () => {
    await open()

    field('ambientes-criar')!.click()
    await settle()
    field('ambientes-novo-nome')!.dispatchEvent(new KeyboardEvent('keyup', { key: 'Escape', bubbles: true }))
    await settle()

    expect(field('ambientes-novo-nome')).toBeUndefined()
  })

  it('guarda a variável editada na lista do ambiente', async () => {
    const { wrapper } = await open()

    await type('ambientes-variaveis-valor-0', 'https://outra.test')
    field('ambientes-salvar')!.click()
    await settle()

    expect(api.saved).toMatchObject({
      vars: [
        { key: 'BASE_URL', value: 'https://outra.test', secret: false },
        { key: 'SENHA', value: null, secret: true }
      ]
    })
    expect(wrapper.findComponent({ name: 'ProjectEnvironmentsVars' }).exists()).toBe(true)
  })

  it('recebe a lista de variáveis que o editor devolve', async () => {
    const { wrapper } = await open()
    const editor = wrapper.findComponent({ name: 'ProjectEnvironmentsVars' })

    editor.vm.$emit('update:modelValue', [{ key: 'NOVA', value: 'valor', secret: false, pending: false }])
    await settle()
    field('ambientes-salvar')!.click()
    await settle()

    expect(api.saved).toMatchObject({ vars: [{ key: 'NOVA', value: 'valor', secret: false }] })
  })

  it('acompanha o modal quando ele mesmo se fecha', async () => {
    const { wrapper, state } = await open()

    wrapper.findComponent({ name: 'BaseModal' }).vm.$emit('update:open', false)
    await settle()

    expect(state.value).toBe(false)
  })

  it('fecha direto quando nada mudou', async () => {
    const { state } = await open()

    field('ambientes-fechar')!.click()
    await settle()

    expect(state.value).toBe(false)
  })
})
