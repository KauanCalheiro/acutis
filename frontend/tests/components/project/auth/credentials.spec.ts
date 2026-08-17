import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ProjectAuthCredentials from '~/components/project/auth/credentials.vue'
import { field, openModal, settle, type } from '../../../support/modal'

const api = { status: 200, saved: null as unknown }

registerEndpoint('/api/projects/alpha-store/auth/credentials', {
  method: 'POST',
  handler: async (event) => {
    api.saved = await readBody(event)
    if (api.status !== 200) throw createError({ statusCode: api.status })

    return { ok: true }
  }
})

beforeEach(() => {
  api.status = 200
  api.saved = null
})

function open() {
  return openModal(ProjectAuthCredentials, { slug: 'alpha-store' })
}

describe('ProjectAuthCredentials', () => {
  it('explica por que precisa das credenciais', async () => {
    await open()

    expect(field('auth-credenciais')!.textContent)
      .toContain('Não identifiquei usuário e senha nesta gravação')
  })

  it('salva o que foi digitado e fecha', async () => {
    const { state, events } = await open()

    await type('auth-credenciais-usuario', 'cliente@loja.test')
    await type('auth-credenciais-senha', 'segredo')
    field('auth-credenciais-salvar')!.click()
    await settle()

    expect(api.saved).toEqual({ username: 'cliente@loja.test', password: 'segredo' })
    expect(state.value).toBe(false)
    expect(events.saved).toHaveLength(1)
  })

  it('mostra o erro e continua aberto quando não salva', async () => {
    api.status = 500
    const { state, events } = await open()

    await type('auth-credenciais-usuario', 'cliente@loja.test')
    await type('auth-credenciais-senha', 'segredo')
    field('auth-credenciais-salvar')!.click()
    await settle()

    expect(field('auth-credenciais-erro')!.textContent).toContain('Não foi possível salvar as credenciais')
    expect(state.value).toBe(true)
    expect(events.saved).toBeUndefined()
  })

  it('acompanha o modal quando ele mesmo se fecha', async () => {
    const { wrapper, state } = await open()

    wrapper.findComponent({ name: 'BaseModal' }).vm.$emit('update:open', false)
    await settle()

    expect(state.value).toBe(false)
  })

  it('fecha sem salvar', async () => {
    const { state } = await open()

    field('auth-credenciais-cancelar')!.click()
    await settle()

    expect(state.value).toBe(false)
    expect(api.saved).toBeNull()
  })
})
