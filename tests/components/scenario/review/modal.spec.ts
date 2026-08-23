import { beforeEach, describe, expect, it } from 'vitest'
import { registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ScenarioReviewModal from '~/components/scenario/review/modal.vue'
import { useWebdriver, type RecorderEvent } from '~/composables/webdriver'
import type { ScenarioDetail } from '~/types/project'
import { field, openModal, settle, type } from '../../../support/modal'

const api = {
  draftStatus: 200,
  commitStatus: 200,
  patchStatus: 200,
  authRecordStatus: 200,
  drafted: null as unknown,
  committed: null as unknown,
  patched: null as unknown,
  authRecorded: null as unknown
}

function cenario(overrides: Partial<ScenarioDetail> = {}): ScenarioDetail {
  return {
    title: 'Login do cliente',
    spec: 'tests/login.spec.ts',
    feature: null,
    tags: ['@read'],
    domain: null,
    playwright: 'test("login", async () => {})',
    gherkin: '@read\nFuncionalidade: Login',
    events: [],
    updated_at: '2026-01-02T10:00:00+00:00',
    is_auth: false,
    runs: [],
    ...overrides
  } as ScenarioDetail
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

registerEndpoint('/api/projects/alpha-store/scenarios/login', {
  method: 'PATCH',
  handler: async (event) => {
    api.patched = await readBody(event)
    if (api.patchStatus !== 200) throw createError({ statusCode: api.patchStatus, data: { message: 'Arquivo já existe' } })

    return { title: 'Login do cliente', spec: 'tests/login.spec.ts' }
  }
})

registerEndpoint('/api/projects/alpha-store/auth/record', {
  method: 'POST',
  handler: async (event) => {
    api.authRecorded = await readBody(event)
    if (api.authRecordStatus !== 200) throw createError({ statusCode: api.authRecordStatus, data: { message: 'O modelo caiu' } })

    return { authSetup: 'tests/auth.setup.ts', credentialsNeeded: false, warnings: [] }
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
  api.patchStatus = 200
  api.authRecordStatus = 200
  api.drafted = null
  api.committed = null
  api.patched = null
  api.authRecorded = null
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

  it('manda a asserção gravada com o que ela afirma, e não só o tipo do evento', async () => {
    recorded(
      { type: 'navigate', url: 'http://loja.test/carrinho', timestamp: 1000 } as Partial<RecorderEvent>,
      {
        type: 'assert',
        url: 'http://loja.test/carrinho',
        timestamp: 2000,
        assert: { assertType: 'url', expectedValue: 'http://loja.test/carrinho' }
      } as Partial<RecorderEvent>
    )
    await open()

    field('revisao-gerar')!.click()
    await settle(6)

    expect((api.drafted as { events: unknown[] }).events[1]).toMatchObject({
      type: 'assert',
      assert: { assertType: 'url', expectedValue: 'http://loja.test/carrinho' }
    })
  })

  it('fecha e pede a retomada com os eventos anteriores ao corte confirmado', async () => {
    const { state, wrapper } = await open()

    const corte = document.body.querySelector<HTMLElement>('[data-testid="revisao-retomar"]')!

    corte.click()
    await settle()
    expect(wrapper.findComponent(ScenarioReviewModal).emitted('resume')).toBeUndefined()

    await new Promise(resolve => setTimeout(resolve, 700))
    corte.click()
    await settle()

    expect(state.value).toBe(false)
    expect(wrapper.findComponent(ScenarioReviewModal).emitted('resume')).toEqual([[
      [{ type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 }]
    ]])
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

describe('ScenarioReviewModal: gravação retomada', () => {
  it('anuncia que a revisão é da retomada, e não de um cenário novo', async () => {
    await open({ scenario: cenario() })

    expect(document.body.textContent).toContain('Revise a gravação retomada')
  })

  it('gera o rascunho mantendo o título, o caminho e o domínio do cenário retomado', async () => {
    await open({ scenario: cenario({ title: 'Entrar no sistema', domain: 'acesso' }) })

    field('revisao-gerar')!.click()
    await settle(6)

    expect((field('contexto-titulo') as HTMLInputElement).value).toBe('Entrar no sistema')
    expect((field('contexto-dominio') as HTMLInputElement).value).toBe('acesso')
  })

  it('sobrescreve o cenário retomado com os eventos novos, em vez de criar outro', async () => {
    const { state, wrapper } = await open({ scenario: cenario() })

    field('revisao-gerar')!.click()
    await settle(6)
    field('contexto-enviar')!.click()
    await settle(6)

    expect(api.committed).toBeNull()
    expect(api.patched).toMatchObject({ title: 'Login do cliente', gherkin: '@read\nFuncionalidade: Login' })
    expect((api.patched as { events: unknown[] }).events).toHaveLength(2)
    expect(state.value).toBe(false)
    expect(wrapper.findComponent(ScenarioReviewModal).emitted('generated')).toHaveLength(1)
  })

  it('mostra o erro de quem não conseguiu sobrescrever', async () => {
    api.patchStatus = 422
    const { state } = await open({ scenario: cenario() })

    field('revisao-gerar')!.click()
    await settle(6)
    field('contexto-enviar')!.click()
    await settle(6)

    expect(field('revisao-erro')!.textContent).toContain('Arquivo já existe')
    expect(state.value).toBe(true)
  })
})

describe('ScenarioReviewModal: gravação de autenticação', () => {
  const auth = () => cenario({ spec: 'tests/auth.setup.ts', is_auth: true })

  it('anuncia que a revisão é do login gravado', async () => {
    await open({ scenario: auth() })

    expect(document.body.textContent).toContain('Revise a gravação do login')
    expect(field('revisao-gerar')!.textContent).toContain('Gerar autenticação')
  })

  it('escreve a autenticação direto da revisão, sem passar pelos contextos', async () => {
    const { state, wrapper } = await open({ scenario: auth() })

    field('revisao-gerar')!.click()
    await settle(8)

    expect(api.authRecorded).toMatchObject({ baseUrl: 'http://loja.test' })
    expect((api.authRecorded as { events: unknown[] }).events).toHaveLength(2)
    expect(field('contexto-titulo')).toBeUndefined()
    expect(state.value).toBe(false)
    expect(wrapper.findComponent(ScenarioReviewModal).emitted('generated')).toEqual([[
      { authSetup: 'tests/auth.setup.ts', credentialsNeeded: false, warnings: [] }
    ]])
  })

  it('recusa escrever a autenticação sem navegação registrada', async () => {
    recorded({ type: 'click', label: 'Entrar', timestamp: 2000 } as Partial<RecorderEvent>)
    await open({ scenario: auth() })

    field('revisao-gerar')!.click()
    await settle(4)

    expect(field('revisao-erro')!.textContent).toContain('Nenhuma navegação registrada')
    expect(api.authRecorded).toBeNull()
  })

  it('volta para a revisão quando a autenticação não sai', async () => {
    api.authRecordStatus = 500
    const { state } = await open({ scenario: auth() })

    field('revisao-gerar')!.click()
    await settle(8)

    expect(field('revisao-erro')!.textContent).toContain('O modelo caiu')
    expect(field('revisao-gerar')).toBeDefined()
    expect(state.value).toBe(true)
  })

  it('oferece regravar e retomar também na revisão do login', async () => {
    const { wrapper } = await open({ scenario: auth() })

    field('revisao-regravar')!.click()
    await settle()

    expect(wrapper.findComponent(ScenarioReviewModal).emitted('rerecord')).toHaveLength(1)
  })
})
