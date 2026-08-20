import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ScenarioReviewModal from '~/components/scenario/review/modal.vue'
import { useWebdriver, type RecorderEvent } from '~/composables/webdriver'
import { field, openModal, settle, type } from '../../../support/modal'

const api = {
  draftStatus: 200,
  commitStatus: 200,
  drafted: null as unknown,
  committed: null as unknown
}

registerEndpoint('/api/projects/alpha-store/tests/draft', {
  method: 'POST',
  handler: async (event) => {
    api.drafted = await readBody(event)
    if (api.draftStatus !== 200) throw createError({ statusCode: api.draftStatus, data: { message: 'O modelo caiu' } })

    return {
      title: 'Login do cliente',
      tags: ['@read'],
      domain: 'login',
      path: 'login-do-cliente',
      gherkin: '@read\nFuncionalidade: Login',
      playwright: 'test("login", async () => {})',
      warnings: ['env-sem-valor: SENHA está vazia']
    }
  }
})

registerEndpoint('/api/projects/alpha-store/tests', {
  method: 'POST',
  handler: async (event) => {
    api.committed = await readBody(event)
    if (api.commitStatus !== 200) throw createError({ statusCode: api.commitStatus, data: { message: 'Arquivo já existe' } })

    return { ok: true }
  }
})

function recorded(...events: Partial<RecorderEvent>[]) {
  useWebdriver().state.value = {
    connected: true,
    extensionReady: true,
    recording: false,
    error: null,
    events: events as RecorderEvent[],
    videoSessionId: 'sessao-1',
    recordingStartedAt: 1000,
    storageState: null
  }
}

beforeEach(() => {
  api.draftStatus = 200
  api.commitStatus = 200
  api.drafted = null
  api.committed = null
  recorded(
    { type: 'fill', label: 'E-mail', value: 'a@b.c', timestamp: 3000 } as Partial<RecorderEvent>,
    { type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 } as Partial<RecorderEvent>,
    { type: 'sem-timestamp' } as Partial<RecorderEvent>
  )
})

function open(props: Record<string, unknown> = {}) {
  return openModal(ScenarioReviewModal, { slug: 'alpha-store', ...props })
}

describe('ScenarioReviewModal', () => {
  it('mostra a gravação em ordem de tempo, com o vídeo da sessão', async () => {
    await open()

    const events = [...document.body.querySelectorAll('[data-testid="revisao-evento"]')]

    expect(events).toHaveLength(2)
    expect(events[0]!.textContent).toContain('Navega para "/login"')
    expect(field('revisao-video')!.getAttribute('src')).toContain('/recording/sessao-1')
  })

  it('gera o cenário e passa para a revisão dos contextos', async () => {
    await open({ isPublic: true })

    field('revisao-gerar')!.click()
    await settle(6)

    expect(api.drafted).toMatchObject({ baseUrl: 'http://loja.test', isPublic: true })
    expect((field('contexto-dominio') as HTMLInputElement).value).toBe('login')
    expect(document.body.textContent).toContain('SENHA está vazia')
  })

  it('recusa gerar sem navegação registrada', async () => {
    recorded({ type: 'click', label: 'Entrar', timestamp: 2000 } as Partial<RecorderEvent>)
    await open()

    field('revisao-gerar')!.click()
    await settle()

    expect(field('revisao-erro')!.textContent).toContain('Nenhuma navegação registrada')
    expect(api.drafted).toBeNull()
  })

  it('volta para a revisão quando a geração falha', async () => {
    api.draftStatus = 500
    await open()

    field('revisao-gerar')!.click()
    await settle(6)

    expect(field('revisao-erro')!.textContent).toContain('O modelo caiu')
    expect(field('revisao-gerar')).toBeDefined()
  })

  it('salva o cenário revisado e avisa a tela', async () => {
    const { state, events } = await open()

    field('revisao-gerar')!.click()
    await settle(6)
    field('contexto-enviar')!.click()
    await settle(6)

    expect(api.committed).toMatchObject({ title: 'Login do cliente', domain: 'login' })
    expect(state.value).toBe(false)
    expect(events.generated).toHaveLength(1)
  })

  it('mostra o erro de quem não conseguiu salvar', async () => {
    const { state } = await open()
    api.commitStatus = 422

    field('revisao-gerar')!.click()
    await settle(6)
    field('contexto-enviar')!.click()
    await settle(6)

    expect(field('revisao-erro')!.textContent).toContain('Arquivo já existe')
    expect(state.value).toBe(true)
  })

  it('fecha e pede outra gravação', async () => {
    const { state, wrapper } = await open()

    field('revisao-regravar')!.click()
    await settle()

    expect(state.value).toBe(false)
    expect(wrapper.findComponent(ScenarioReviewModal).emitted('rerecord')).toHaveLength(1)
  })

  it('recusa gerar quando a navegação registrada não é um endereço válido', async () => {
    recorded({ type: 'navigate', url: 'http://[', timestamp: 1000 } as Partial<RecorderEvent>)
    await open()

    field('revisao-gerar')!.click()
    await settle()

    expect(field('revisao-erro')!.textContent).toContain('Nenhuma navegação registrada')
  })

  it('cancela na revisão dos contextos, sem salvar', async () => {
    const { state } = await open()

    field('revisao-gerar')!.click()
    await settle(6)
    field('contexto-cancelar')!.click()
    await settle()

    expect(state.value).toBe(false)
    expect(api.committed).toBeNull()
  })

  it('guarda a edição feita nos contextos', async () => {
    await open()

    field('revisao-gerar')!.click()
    await settle(6)
    await type('contexto-dominio', 'checkout')
    field('contexto-enviar')!.click()
    await settle(6)

    expect(api.committed).toMatchObject({ domain: 'checkout' })
  })

  it('recebe o rascunho que os contextos devolvem', async () => {
    const { wrapper } = await open()

    field('revisao-gerar')!.click()
    await settle(6)

    const contexts = wrapper.findComponent({ name: 'ScenarioReviewContexts' })

    contexts.vm.$emit('update:draft', { ...(contexts.props('draft') as object), title: 'Entrar no sistema' })
    await settle()
    field('contexto-enviar')!.click()
    await settle(6)

    expect(api.committed).toMatchObject({ title: 'Entrar no sistema' })
  })

  it('acompanha o modal quando ele mesmo se fecha', async () => {
    const { wrapper, state } = await open()

    wrapper.findComponent({ name: 'BaseModal' }).vm.$emit('update:open', false)
    await settle()

    expect(state.value).toBe(false)
  })

  it('cancela a revisão', async () => {
    const { state } = await open()

    field('revisao-cancelar')!.click()
    await settle()

    expect(state.value).toBe(false)
  })
})
