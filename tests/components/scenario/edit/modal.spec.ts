import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ScenarioEditModal from '~/components/scenario/edit/modal.vue'
import { dismiss, field, openModal, settle, type } from '../../../support/modal'
import type { ScenarioDetail } from '~/types/project'

const api = { status: 200, saved: null as unknown }

registerEndpoint('/api/projects/alpha-store/scenarios/login/login-do-cliente', {
  method: 'PATCH',
  handler: async (event) => {
    api.saved = await readBody(event)
    if (api.status !== 200) throw createError({ statusCode: api.status, data: { message: 'Título repetido' } })

    return { spec: 'tests/login/login-do-cliente.spec.ts', title: 'Login do cliente' }
  }
})

registerEndpoint('/api/projects/alpha-store/scenarios/auth/login', {
  method: 'PATCH',
  handler: () => ({ spec: 'tests/auth/login.setup.ts', title: 'Autenticação' })
})

beforeEach(() => {
  api.status = 200
  api.saved = null
})

function scenario(overrides: Partial<ScenarioDetail> = {}): ScenarioDetail {
  return {
    spec: 'tests/login/login-do-cliente.spec.ts',
    title: 'Login do cliente',
    tags: ['@read'],
    gherkin: '@read\nFuncionalidade: Login',
    playwright: 'test("login", async () => {})',
    is_auth: false,
    ...overrides
  } as ScenarioDetail
}

function open(detail = scenario()) {
  return openModal(ScenarioEditModal, { slug: 'alpha-store', scenario: detail })
}

describe('ScenarioEditModal', () => {
  it('abre com os contextos do cenário gravado', async () => {
    await open()

    expect(document.body.textContent).toContain('Editar cenário')
    expect((field('contexto-dominio') as HTMLInputElement).value).toBe('login')
  })

  it('chama a autenticação pelo nome dela', async () => {
    await open(scenario({ spec: 'tests/auth/login.setup.ts', is_auth: true }))

    expect(document.body.textContent).toContain('Editar autenticação')
  })

  it('salva o cenário editado e devolve o que voltou do servidor', async () => {
    const { state, events } = await open()

    await type('contexto-dominio', 'checkout')
    field('cenario-editar-salvar')!.click()
    await settle()

    expect(api.saved).toMatchObject({ domain: 'checkout', title: 'Login do cliente' })
    expect(state.value).toBe(false)
    expect(events.updated).toHaveLength(1)
  })

  it('mostra o erro do servidor e continua aberto', async () => {
    api.status = 422
    const { state } = await open()

    field('cenario-editar-salvar')!.click()
    await settle()

    expect(document.body.textContent).toContain('Título repetido')
    expect(state.value).toBe(true)
  })

  it('guarda a edição do gherkin junto do resto', async () => {
    await open()

    await type('contexto-cenario', '@read\nFuncionalidade: Login\n  Cenário: entra')
    field('cenario-editar-salvar')!.click()
    await settle()

    expect(api.saved).toMatchObject({ gherkin: '@read\nFuncionalidade: Login\n  Cenário: entra' })
  })

  it('recebe o rascunho que os contextos devolvem', async () => {
    const { wrapper } = await open()
    const contexts = wrapper.findComponent({ name: 'ScenarioReviewContexts' })

    contexts.vm.$emit('update:draft', { ...(contexts.props('draft') as object), title: 'Entrar no sistema' })
    await settle()
    field('cenario-editar-salvar')!.click()
    await settle()

    expect(api.saved).toMatchObject({ title: 'Entrar no sistema' })
  })

  it('fecha pelo esc', async () => {
    const { state } = await open()

    await dismiss()

    expect(state.value).toBe(false)
  })

  it('cancela sem salvar', async () => {
    const { state } = await open()

    field('cenario-editar-cancelar')!.click()
    await settle()

    expect(state.value).toBe(false)
    expect(api.saved).toBeNull()
  })
})
