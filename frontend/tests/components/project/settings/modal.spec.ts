import { beforeEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ProjectSettingsModal from '~/components/project/settings/modal.vue'
import { field, openModal, settle, type } from '../../../support/modal'

const toasts: Array<{ title: string, color: string }> = []

mockNuxtImport('useToast', () => () => ({ add: (toast: { title: string, color: string }) => toasts.push(toast) }))

const api = { saveStatus: 200, skipStatus: 200, saved: null as unknown, skipped: false }

registerEndpoint('/api/projects/alpha-store/settings', {
  method: 'PUT',
  handler: async (event) => {
    api.saved = await readBody(event)
    if (api.saveStatus !== 200) throw createError({ statusCode: api.saveStatus, data: { message: 'URL inválida' } })

    return { ok: true }
  }
})

registerEndpoint('/api/projects/alpha-store/settings/skip', {
  method: 'POST',
  handler: () => {
    api.skipped = true
    if (api.skipStatus !== 200) throw createError({ statusCode: api.skipStatus, data: { message: 'Projeto sumiu' } })

    return { ok: true }
  }
})

beforeEach(() => {
  toasts.length = 0
  api.saveStatus = 200
  api.skipStatus = 200
  api.saved = null
  api.skipped = false
})

function open(baseUrl: string | null = null) {
  return openModal(ProjectSettingsModal, { slug: 'alpha-store', baseUrl })
}

describe('ProjectSettingsModal', () => {
  it('abre com a URL que o projeto já tinha', async () => {
    await open('https://loja.test')

    expect((field('projeto-configuracoes-base-url') as HTMLInputElement).value).toBe('https://loja.test')
  })

  it('salva a URL sem espaço em volta e avisa', async () => {
    const { state, events } = await open()

    await type('projeto-configuracoes-base-url', '  https://loja.test  ')
    field('projeto-configuracoes-salvar')!.click()
    await settle()

    expect(api.saved).toEqual({ baseUrl: 'https://loja.test' })
    expect(state.value).toBe(false)
    expect(events.saved).toHaveLength(1)
    expect(toasts.at(-1)).toEqual({ title: 'Configurações salvas', color: 'success', icon: 'i-ic-round-check-circle' })
  })

  it('avisa quando a URL não salva, e não fecha', async () => {
    api.saveStatus = 422
    const { state } = await open('https://loja.test')

    field('projeto-configuracoes-salvar')!.click()
    await settle()

    expect(toasts.at(-1)!.title).toBe('URL inválida')
    expect(state.value).toBe(true)
  })

  it('deixa a URL em branco quando o usuário prefere digitar na gravação', async () => {
    const { state, events } = await open()

    field('projeto-configuracoes-pular')!.click()
    await settle()

    expect(api.skipped).toBe(true)
    expect(state.value).toBe(false)
    expect(events.saved).toHaveLength(1)
  })

  it('acompanha o modal quando ele mesmo se fecha', async () => {
    const { wrapper, state } = await open('https://loja.test')

    wrapper.findComponent({ name: 'BaseModal' }).vm.$emit('update:open', false)
    await settle()

    expect(state.value).toBe(false)
  })

  it('avisa quando nem deixar em branco funciona', async () => {
    api.skipStatus = 500
    const { state } = await open()

    field('projeto-configuracoes-pular')!.click()
    await settle()

    expect(toasts.at(-1)!.title).toBe('Projeto sumiu')
    expect(state.value).toBe(true)
  })
})
