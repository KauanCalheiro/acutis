import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { createError, readBody } from 'h3'
import { defineComponent, h } from 'vue'
import { UApp } from '#components'
import ScenarioPage from '~/pages/projects/[projectSlug]/scenarios/[...scenario].vue'
import { useWebdriver, type RecorderEvent } from '~/composables/webdriver'
import { settle } from '../support/modal'
import type { ProjectDetail, ScenarioDetail, ScenarioRun } from '~/types/project'

const navigate = vi.hoisted(() => vi.fn())
const ai = vi.hoisted(() => ({ configured: { __v_isRef: true, value: true } }))

mockNuxtImport('navigateTo', () => navigate)
mockNuxtImport('useAi', () => () => ai)

// ponytail: EventSource falso no lugar do SSE do runner.
class FakeEventSource {
  static last: FakeEventSource | undefined

  onmessage: ((message: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(readonly url: string) {
    FakeEventSource.last = this
  }

  close() {
    this.closed = true
  }

  send(event: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }
}

function project(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    name: 'Alpha Store',
    slug: 'alpha-store',
    path: '/home/user/.acutis/alpha-store',
    repository: null,
    provider: null,
    created_at: '2026-01-01T00:00:00+00:00',
    branch: 'main',
    updated_at: '2026-01-02T10:00:00+00:00',
    scenarios: [],
    auth_status: 'configured',
    base_url: 'https://loja.test',
    storage_state: '/tmp/storage-state.json',
    requires_url: false,
    vscode_url: 'vscode://file/x',
    has_report: false,
    ...overrides
  } as ProjectDetail
}

function run(overrides: Partial<ScenarioRun> = {}): ScenarioRun {
  return {
    started_at: '2026-01-02T10:00:00.000Z',
    duration_ms: 3000,
    passed: false,
    branch: 'main',
    author: 'Kauan',
    steps: [{ title: 'entra', status: 'failed', duration_ms: 10, error: 'locator não encontrado' }],
    playwright: 'test("login", async () => {})',
    video_path: '/runs/1/video.webm',
    ...overrides
  } as ScenarioRun
}

function scenario(overrides: Partial<ScenarioDetail> = {}): ScenarioDetail {
  return {
    title: 'Login do cliente',
    spec: 'tests/login.spec.ts',
    feature: null,
    tags: ['@read'],
    domain: null,
    playwright: 'test("login", async () => {})',
    gherkin: '@read\nFuncionalidade: Login',
    events: [{ type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 }] as unknown as RecorderEvent[],
    updated_at: '2026-01-02T10:00:00+00:00',
    is_auth: false,
    runs: [],
    ...overrides
  } as ScenarioDetail
}

const api = {
  project: project(),
  scenario: scenario(),
  authScenario: scenario({ spec: 'tests/auth.setup.ts', title: 'Autenticação', is_auth: true, gherkin: null, events: [] }),
  removed: false,
  patched: null as unknown,
  drafted: null as unknown,
  suggestionsStatus: 200,
  fixStatus: 200,
  authSkipped: false,
  authRecorded: null as unknown,
  credentialsNeeded: false,
  authRecordStatus: 200,
  authWarnings: [] as string[],
  scenarioMissing: false
}

registerEndpoint('/api/projects/alpha-store', () => api.project)
registerEndpoint('/api/projects/alpha-store/scenarios/login', {
  method: 'GET',
  handler: () => {
    if (api.scenarioMissing) throw createError({ statusCode: 404 })

    return api.scenario
  }
})
registerEndpoint('/api/projects/alpha-store/scenarios/auth', {
  method: 'GET',
  handler: () => api.authScenario
})
registerEndpoint('/api/projects/alpha-store/scenarios/login', {
  method: 'DELETE',
  handler: () => {
    api.removed = true

    return { ok: true }
  }
})
registerEndpoint('/api/projects/alpha-store/scenarios/login', {
  method: 'PATCH',
  handler: async (event) => {
    api.patched = await readBody(event)

    return api.scenario
  }
})
registerEndpoint('/api/projects/alpha-store/tests/draft', {
  method: 'POST',
  handler: async (event) => {
    api.drafted = await readBody(event)

    return {
      title: 'Entrar na loja',
      tags: ['@read'],
      domain: 'acesso',
      path: 'entrar-na-loja',
      gherkin: '@read\nFuncionalidade: Entrar',
      playwright: 'test("login refeito", async () => {})'
    }
  }
})
registerEndpoint('/api/projects/alpha-store/scenario-suggestions', {
  method: 'POST',
  handler: () => {
    if (api.suggestionsStatus !== 200) throw createError({ statusCode: api.suggestionsStatus, data: { message: 'O modelo caiu' } })

    return [{
      event: 'Clica em Entrar',
      currentSelector: 'button:nth-child(2)',
      suggestedTestId: 'login-entrar',
      reason: 'Seletor por posição'
    }]
  }
})
registerEndpoint('/api/projects/alpha-store/scenario-fix', {
  method: 'POST',
  handler: () => {
    if (api.fixStatus !== 200) throw createError({ statusCode: api.fixStatus, data: { message: 'Não consegui corrigir' } })

    return { playwright: 'await page.getByTestId("entrar").click()', summary: 'Troquei o seletor' }
  }
})
registerEndpoint('/api/projects/alpha-store/auth/skip', {
  method: 'POST',
  handler: () => {
    api.authSkipped = true

    return { ok: true }
  }
})
registerEndpoint('/api/projects/alpha-store/auth/record', {
  method: 'POST',
  handler: async (event) => {
    api.authRecorded = await readBody(event)
    if (api.authRecordStatus !== 200) throw createError({ statusCode: api.authRecordStatus })

    return {
      authSetup: 'tests/auth.setup.ts',
      credentialsNeeded: api.credentialsNeeded,
      warnings: api.authWarnings
    }
  }
})
registerEndpoint('/api/projects/alpha-store/auth/credentials', {
  method: 'POST',
  handler: () => ({ ok: true })
})

function recorder(overrides: Record<string, unknown> = {}) {
  useWebdriver().state.value = {
    connected: true,
    extensionReady: true,
    recording: false,
    error: null,
    events: [],
    videoSessionId: null,
    recordingStartedAt: null,
    storageState: null,
    ...overrides
  } as ReturnType<typeof useWebdriver>['state']['value']
}

let mounted: { unmount: () => void } | undefined

beforeEach(() => {
  clearNuxtData()
  navigate.mockClear()
  FakeEventSource.last = undefined
  vi.stubGlobal('EventSource', FakeEventSource)
  ai.configured.value = true
  api.project = project()
  api.scenario = scenario()
  api.authScenario = scenario({ spec: 'tests/auth.setup.ts', title: 'Autenticação', is_auth: true, gherkin: null, events: [] })
  api.removed = false
  api.patched = null
  api.drafted = null
  api.suggestionsStatus = 200
  api.fixStatus = 200
  api.authSkipped = false
  api.authRecorded = null
  api.credentialsNeeded = false
  api.authRecordStatus = 200
  api.authWarnings = []
  api.scenarioMissing = false
  recorder()
})

afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function mount(route = '/projects/alpha-store/scenarios/login') {
  const host = defineComponent({
    setup() {
      return () => h(UApp, null, { default: () => h(ScenarioPage) })
    }
  })

  const wrapper = await mountSuspended(host, { route })
  mounted = wrapper

  return wrapper
}

function field(testid: string) {
  return [...document.body.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)].at(-1)
}

/** O gatilho da aba não reage a click no jsdom; trocar pelo v-model é o mesmo caminho da tela. */
async function openTab(wrapper: Awaited<ReturnType<typeof mount>>, value: string) {
  expect(wrapper.find(`[data-testid="cenario-tab-${value}"]`).exists()).toBe(true)
  wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', value)
  await settle()
}

describe('ScenarioPage', () => {
  it('mostra título, caminho, tags e os eventos gravados', async () => {
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="cenario-titulo"]').text()).toBe('Login do cliente')
    expect(wrapper.get('[data-testid="cenario-caminho"]').text()).toBe('tests/login.spec.ts')
    expect(wrapper.get('[data-testid="cenario-tags"]').text()).toContain('@read')
    expect(wrapper.get('[data-testid="cenario-origem"]').text()).toContain('Local')
    expect(wrapper.findAll('[data-testid="revisao-evento"]')).toHaveLength(1)
  })

  it('avisa quando o cenário foi escrito sem gravação', async () => {
    api.scenario = scenario({ events: [] })
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="cenario-eventos-vazio"]').text()).toContain('Nenhum evento gravado')
  })

  it('mostra o gherkin e o script nas abas deles', async () => {
    const wrapper = await mount()

    await openTab(wrapper, 'gherkin')
    expect((wrapper.get('[data-testid="cenario-gherkin"]').element as HTMLTextAreaElement).value)
      .toContain('Funcionalidade: Login')

    await openTab(wrapper, 'playwright')
    expect((wrapper.get('[data-testid="cenario-playwright"]').element as HTMLTextAreaElement).value)
      .toContain('test("login"')
  })

  it('esconde a aba do gherkin no cenário que não tem um', async () => {
    api.scenario = scenario({ gherkin: null })
    const wrapper = await mount()

    expect(wrapper.find('[data-testid="cenario-tab-gherkin"]').exists()).toBe(false)
  })

  it('avisa quando o arquivo do script está vazio', async () => {
    api.scenario = scenario({ playwright: '   ' })
    const wrapper = await mount()

    await openTab(wrapper, 'playwright')

    expect(wrapper.get('[data-testid="cenario-playwright-vazio"]').text()).toContain('Sem código Playwright')
  })

  it('abre a execução escolhida no histórico', async () => {
    api.scenario = scenario({ runs: [run()] })
    const wrapper = await mount()

    await openTab(wrapper, 'execucoes')
    await wrapper.get('[data-testid="cenario-execucao"]').trigger('click')
    await settle()

    expect(field('execucao-status')!.textContent).toContain('Falha')
    expect(field('execucao-video')).toBeDefined()
    expect((field('execucao-playwright') as HTMLTextAreaElement).value).toContain('test("login"')
  })

  it('exclui o cenário depois de confirmar', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-excluir"]').trigger('click')
    await settle()
    field('cenario-excluir-confirmar')!.click()
    await settle()

    expect(api.removed).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store')
  })

  it('retoma a gravação do passo escolhido e reescreve o cenário com os eventos novos', async () => {
    api.scenario = scenario({
      events: [
        { type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 },
        { type: 'fill', label: 'E-mail', value: 'a@b.c', timestamp: 2000 },
        { type: 'submit', timestamp: 3000 }
      ] as unknown as RecorderEvent[]
    })
    const wrapper = await mount()

    const corte = wrapper.findAll('[data-testid="revisao-retomar"]')[1]!
    await corte.trigger('click')
    await new Promise(resolve => setTimeout(resolve, 700))
    await corte.trigger('click')
    await settle()

    expect(useWebdriver().state.value.recording).toBe(true)
    expect(useWebdriver().state.value.events).toHaveLength(2)

    await wrapper.get('[data-testid="cenario-parar"]').trigger('click')
    useWebdriver().state.value.events = [
      ...useWebdriver().state.value.events,
      { type: 'click', label: 'Entrar', timestamp: 4000 } as RecorderEvent
    ]
    useWebdriver().state.value.videoSessionId = 'sessao-1'
    await settle(8)

    field('revisao-gerar')!.click()
    await settle(8)

    expect(api.drafted).toMatchObject({ baseUrl: 'http://loja.test' })
    expect((api.drafted as { events: unknown[] }).events).toHaveLength(3)
    expect((field('contexto-titulo') as HTMLInputElement).value).toBe('Login do cliente')

    field('contexto-enviar')!.click()
    await settle(6)

    expect(api.patched).toMatchObject({
      title: 'Login do cliente',
      path: 'login',
      domain: '',
      playwright: 'test("login refeito", async () => {})',
      gherkin: '@read\nFuncionalidade: Entrar'
    })
    expect((api.patched as { events: unknown[] }).events).toHaveLength(3)
  })

  it('abre a edição e recarrega quando o cenário continua o mesmo', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-editar"]').trigger('click')
    await settle()
    expect(field('contexto-dominio')).toBeDefined()

    wrapper.findComponent({ name: 'ScenarioEditModal' }).vm.$emit('updated', scenario())
    await settle()

    expect(navigate).not.toHaveBeenCalled()
  })

  it('vai para o endereço novo quando a edição renomeia o cenário', async () => {
    const wrapper = await mount()

    wrapper.findComponent({ name: 'ScenarioEditModal' }).vm
      .$emit('updated', scenario({ spec: 'tests/checkout/login.spec.ts' }))
    await settle()

    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store/scenarios/checkout/login')
  })

  it('não oferece sugestões sem IA configurada', async () => {
    ai.configured.value = false
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="cenario-sugestoes"]').classes()).toContain('pointer-events-none')
  })

  it('pede as sugestões de seletor à IA', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-sugestoes"]').trigger('click')
    await settle(6)

    expect(field('sugestao-testid')!.textContent).toContain('login-entrar')
  })

  it('avisa quando as sugestões não saem', async () => {
    api.suggestionsStatus = 500
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-sugestoes"]').trigger('click')
    await settle(6)

    expect(document.body.textContent).toContain('O modelo caiu')
  })

  it('roda o cenário e mostra a timeline da execução', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-testar"]').trigger('click')
    await settle()

    expect(FakeEventSource.last!.url).toContain('spec=tests%2Flogin.spec.ts')

    FakeEventSource.last!.send({ event: 'run:started', steps: ['abre o login'] })
    FakeEventSource.last!.send({ event: 'step', title: 'abre o login', status: 'pending' })
    FakeEventSource.last!.send({ event: 'step', title: 'abre o login', status: 'failed', error: 'locator não encontrado' })
    FakeEventSource.last!.send({ event: 'run:finished', passed: false, output: '' })
    await settle()

    expect(document.body.textContent).toContain('locator não encontrado')
  })

  async function failedRun() {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-testar"]').trigger('click')
    await settle()
    FakeEventSource.last!.send({ event: 'run:started', steps: ['abre o login'] })
    FakeEventSource.last!.send({ event: 'step', title: 'abre o login', status: 'pending' })
    FakeEventSource.last!.send({ event: 'step', title: 'abre o login', status: 'failed', error: 'locator não encontrado' })
    FakeEventSource.last!.send({ event: 'run:finished', passed: false, output: '' })
    await settle()

    return wrapper
  }

  it('aplica a correção proposta pela IA', async () => {
    await failedRun()

    field('execucao-corrigir')!.click()
    await settle(6)

    expect(field('correcao-resumo')!.textContent).toContain('Troquei o seletor')

    field('correcao-aplicar')!.click()
    await settle(6)

    expect(api.patched).toMatchObject({ playwright: 'await page.getByTestId("entrar").click()' })
  })

  it('descarta a correção proposta', async () => {
    await failedRun()

    field('execucao-corrigir')!.click()
    await settle(6)
    field('correcao-descartar')!.click()
    await settle()

    expect(api.patched).toBeNull()
  })

  it('descarta a correção e acompanha a espera da escrita da autenticação', async () => {
    const wrapper = await failedRun()

    field('execucao-corrigir')!.click()
    await settle(6)
    wrapper.findComponent({ name: 'ScenarioFixModal' }).vm.$emit('discard')
    await settle()

    expect(wrapper.findComponent({ name: 'ScenarioFixModal' }).props('fix')).toBeNull()

    // O modal de espera é controlado por `writingAuth`, que acompanha o fechar do próprio modal.
    const espera = wrapper.findAllComponents({ name: 'BaseModal' }).at(-1)!

    espera.vm.$emit('update:open', false)
    await settle()

    expect(espera.props('open')).toBe(false)
  })

  it('avisa quando a IA não consegue corrigir', async () => {
    api.fixStatus = 500
    await failedRun()

    field('execucao-corrigir')!.click()
    await settle(6)

    expect(field('correcao-erro')!.textContent).toContain('Não consegui corrigir')
  })
})

describe('ScenarioPage: fechaduras e ausências', () => {
  it('fecha cada modal que a própria tela abriu', async () => {
    const wrapper = await mount()

    for (const name of [
      'BaseConfirm',
      'ScenarioEditModal',
      'ScenarioSuggestionsModal',
      'ScenarioTestRunModal',
      'ProjectAuthCredentials',
      'ScenarioFixModal'
    ]) {
      wrapper.findComponent({ name }).vm.$emit('update:open', false)
      await settle()
      expect(wrapper.findComponent({ name }).props('open')).toBe(false)
    }
  })

  it('volta para a aba de eventos quando a edição apaga o gherkin', async () => {
    const wrapper = await mount()

    await openTab(wrapper, 'gherkin')
    api.scenario = scenario({ gherkin: null })
    wrapper.findComponent({ name: 'ScenarioEditModal' }).vm.$emit('updated', api.scenario)
    await settle(6)

    expect(wrapper.find('[data-testid="cenario-eventos"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cenario-tab-gherkin"]').exists()).toBe(false)
  })

  // O 404 do cenário que não existe é verificado no E2E: montar a página sem cenário deixa o Vue
  // renderizando um estado que a rota real nunca chega a mostrar.
})

describe('ScenarioPage: autenticação', () => {
  const route = '/projects/alpha-store/scenarios/auth'

  it('convida a gravar o login quando ainda não há autenticação', async () => {
    api.authScenario = scenario({ spec: 'tests/auth.setup.ts', is_auth: true, playwright: '', gherkin: null, events: [] })
    api.project = project({ auth_status: 'unset' })
    const wrapper = await mount(route)

    expect(wrapper.get('[data-testid="auth-intro"]').text()).toContain('Autenticação ainda não gravada')
    expect(wrapper.find('[data-testid="cenario-excluir"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cenario-testar"]').exists()).toBe(false)

    await wrapper.get('[data-testid="auth-dispensar"]').trigger('click')
    await settle()

    expect(api.authSkipped).toBe(true)
  })

  it('mostra o estado da autenticação já configurada', async () => {
    const wrapper = await mount(route)

    expect(wrapper.get('[data-testid="cenario-auth-status"]').text()).toContain('Configurada')
    expect(wrapper.find('[data-testid="auth-gravar"]').exists()).toBe(true)
  })

  it('grava o login e escreve a autenticação com o que foi gravado', async () => {
    const wrapper = await mount(route)

    await wrapper.get('[data-testid="auth-gravar"]').trigger('click')
    expect(useWebdriver().state.value.recording).toBe(true)
    expect(wrapper.find('[data-testid="cenario-parar"]').exists()).toBe(true)

    await wrapper.get('[data-testid="cenario-parar"]').trigger('click')
    useWebdriver().state.value.events = [
      { type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 }
    ] as unknown as RecorderEvent[]
    useWebdriver().state.value.videoSessionId = 'sessao-1'
    await settle(8)

    expect(document.body.textContent).toContain('Revise a gravação do login')
    field('revisao-gerar')!.click()
    await settle(8)

    expect(api.authRecorded).toMatchObject({ baseUrl: 'http://loja.test' })
    // Sem credencial pendente, o login já é executado para confirmar que funciona.
    expect(FakeEventSource.last!.url).toContain('spec=tests%2Fauth.setup.ts')
  })

  it('pede as credenciais quando a gravação não as revelou', async () => {
    api.credentialsNeeded = true
    api.authWarnings = ['env-sem-valor: SENHA está vazia']
    const wrapper = await mount(route)

    await wrapper.get('[data-testid="auth-gravar"]').trigger('click')
    useWebdriver().state.value.events = [
      { type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 }
    ] as unknown as RecorderEvent[]
    useWebdriver().state.value.videoSessionId = 'sessao-2'
    await settle(8)

    field('revisao-gerar')!.click()
    await settle(8)

    expect(field('auth-credenciais')).toBeDefined()
    expect(wrapper.get('[data-testid="geracao-ressalvas"]').text()).toContain('SENHA está vazia')
  })

  it('reclama da gravação que não registrou página nenhuma', async () => {
    const wrapper = await mount(route)

    await wrapper.get('[data-testid="auth-gravar"]').trigger('click')
    useWebdriver().state.value.videoSessionId = 'sessao-3'
    await settle(4)

    field('revisao-gerar')!.click()
    await settle(4)

    expect(field('revisao-erro')!.textContent).toContain('Nenhuma navegação registrada')
    expect(api.authRecorded).toBeNull()
  })

  it('avisa quando não consegue escrever a autenticação', async () => {
    api.authRecordStatus = 500
    const wrapper = await mount(route)

    await wrapper.get('[data-testid="auth-gravar"]').trigger('click')
    useWebdriver().state.value.events = [
      { type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 }
    ] as unknown as RecorderEvent[]
    useWebdriver().state.value.videoSessionId = 'sessao-4'
    await settle(8)

    field('revisao-gerar')!.click()
    await settle(8)

    expect(field('revisao-erro')!.textContent).toContain('Não foi possível gerar a autenticação')
  })
})
