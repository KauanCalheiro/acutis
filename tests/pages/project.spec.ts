import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { defineComponent, h } from 'vue'
import { createError } from 'h3'
import { UApp } from '#components'
import ProjectPage from '~/pages/projects/[slug].vue'
import { useWebdriver } from '~/composables/webdriver'
import { settle } from '../support/modal'
import type { ProjectDetail, Scenario } from '~/types/project'

const navigate = vi.hoisted(() => vi.fn())

mockNuxtImport('navigateTo', () => navigate)

// ponytail: EventSource falso no lugar do SSE do runner, com o teste empurrando os eventos na mão.
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

function scenario(title: string, spec: string, tags: string[] = ['@read'], skipped = false): Scenario {
  return { title, spec, feature: null, tags, domain: null, skipped }
}

const api = {
  project: {} as ProjectDetail,
  vars: [] as { key: string, value: string, secret: boolean, pending: boolean }[],
  synced: false,
  conflict: false,
  unavailable: false,
  skipped: false,
  removed: false,
  missing: false
}

function project(overrides: Partial<ProjectDetail> = {}): ProjectDetail {
  return {
    name: 'Alpha Store',
    slug: 'alpha-store',
    path: '/home/user/.acutis/alpha-store',
    repository: 'git@github.com:acme/alpha-store.git',
    provider: 'github',
    created_at: '2026-01-01T00:00:00+00:00',
    branch: 'main',
    updated_at: '2026-01-02T10:00:00+00:00',
    scenarios: [scenario('Login do cliente', 'tests/login.spec.ts'), scenario('Cadastro de produto', 'tests/produto.spec.ts', ['@write'])],
    auth_status: 'configured',
    base_url: 'https://loja.test',
    storage_state: '/tmp/storage-state.json',
    requires_url: false,
    vscode_url: 'vscode://file/home/user/.acutis/alpha-store',
    has_report: true,
    ...overrides
  } as ProjectDetail
}

registerEndpoint('/api/projects/alpha-store', () => {
  if (api.missing) throw createError({ statusCode: 404 })

  return api.project
})

registerEndpoint('/api/projects/alpha-store/environments', () => ({
  active: 'homologacao',
  known_keys: [],
  environments: [{ slug: 'homologacao', name: 'Homologação', vars: api.vars }]
}))

registerEndpoint('/api/projects/alpha-store/git/sync', {
  method: 'POST',
  handler: () => {
    api.synced = true

    if (api.unavailable) return { status: 'unavailable', changed: false, reason: 'network' }

    return api.conflict
      ? { status: 'conflict', changed: false }
      : { status: 'synced', changed: false }
  }
})

registerEndpoint('/api/projects/alpha-store/auth/skip', {
  method: 'POST',
  handler: () => {
    api.skipped = true
    // A ação mexeu no projeto, então a próxima leitura traz outra data de modificação.
    api.project = project({ auth_status: 'skipped', updated_at: '2026-01-02T11:00:00+00:00' })

    return { ok: true }
  }
})

registerEndpoint('/api/projects/alpha-store', {
  method: 'DELETE',
  handler: () => {
    api.removed = true

    return { ok: true }
  }
})

function connected(overrides: Record<string, unknown> = {}) {
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

beforeEach(() => {
  clearNuxtData()
  navigate.mockClear()
  FakeEventSource.last = undefined
  vi.stubGlobal('EventSource', FakeEventSource)
  api.project = project()
  api.vars = []
  api.synced = false
  api.conflict = false
  api.unavailable = false
  api.skipped = false
  api.removed = false
  api.missing = false
  connected()
})

// A tela vive num app montado; desmontar antes de limpar o body evita que o Vue do caso anterior
// tente repintar nós que não existem mais quando o estado global do gravador muda.
let mounted: { unmount: () => void } | undefined

afterEach(() => {
  mounted?.unmount()
  mounted = undefined
  vi.unstubAllGlobals()
  document.body.innerHTML = ''
})

async function mount(route = '/projects/alpha-store') {
  const host = defineComponent({
    setup() {
      return () => h(UApp, null, { default: () => h(ProjectPage) })
    }
  })

  const wrapper = await mountSuspended(host, { route })
  mounted = wrapper

  return wrapper
}

function field(testid: string) {
  return [...document.body.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)].at(-1)
}

describe('ProjectPage', () => {
  it('mostra origem, caminho, branch e os cenários do projeto', async () => {
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="projeto-origem"]').text()).toContain('GitHub')
    expect(wrapper.get('[data-testid="projeto-caminho"]').text()).toBe('/home/user/.acutis/alpha-store')
    expect(wrapper.get('[data-testid="projeto-branch"]').text()).toContain('main')
    expect(wrapper.findAll('[data-testid="cenario-card"]')).toHaveLength(2)
    expect(wrapper.get('[data-testid="projeto-relatorio"]').attributes('href')).toContain('alpha-store')
    expect(wrapper.get('[data-testid="projeto-vscode"]').attributes('href')).toContain('vscode://')
  })

  it('marca no card o cenário que está pulado', async () => {
    api.project = project({
      scenarios: [
        scenario('Login do cliente', 'tests/login.spec.ts'),
        scenario('Mensagens de falha', 'tests/diagnostico/falhas.spec.ts', ['@read'], true)
      ]
    })
    const wrapper = await mount()

    const cards = wrapper.findAll('[data-testid="cenario-card"]')

    expect(cards[0]!.find('[data-testid="cenario-card-pulado"]').exists()).toBe(false)
    expect(cards[1]!.get('[data-testid="cenario-card-pulado"]').text()).toContain('Pulado')
  })

  it('avisa quais variáveis do ambiente ativo ainda estão sem valor', async () => {
    api.vars = [
      { key: 'URL', value: 'https://loja.test', secret: false, pending: false },
      { key: 'CUPOM_TESTE', value: '', secret: false, pending: true },
      { key: 'API_TOKEN', value: '', secret: true, pending: true }
    ]
    const wrapper = await mount()

    const aviso = wrapper.get('[data-testid="projeto-variaveis-aviso"]')

    expect(aviso.text()).toContain('CUPOM_TESTE')
    expect(aviso.text()).toContain('API_TOKEN')
    expect(aviso.text()).not.toContain('URL')
  })

  it('não avisa nada quando o ambiente ativo está preenchido', async () => {
    api.vars = [{ key: 'URL', value: 'https://loja.test', secret: false, pending: false }]
    const wrapper = await mount()

    expect(wrapper.find('[data-testid="projeto-variaveis-aviso"]').exists()).toBe(false)
  })

  it('sincroniza com o repositório assim que a tela abre', async () => {
    await mount()
    await settle(4)

    expect(api.synced).toBe(true)
  })

  it('sincroniza de novo depois de uma ação, sem a ação esperar por isso', async () => {
    api.project = project({ auth_status: 'unset' })
    const wrapper = await mount()
    await settle(4)
    api.synced = false

    await wrapper.get('[data-testid="projeto-auth-dispensar"]').trigger('click')
    await settle(6)

    expect(api.synced, 'a ação dispara a sincronização por conta própria').toBe(true)
  })

  it('marca o atalho do editor quando sobrou conflito, e explica no tooltip', async () => {
    api.conflict = true
    const wrapper = await mount()
    await settle(4)

    expect(wrapper.findComponent({ name: 'UChip' }).props('show'), 'a marca aparece no atalho').toBe(true)
    expect(wrapper.get('[data-testid="projeto-vscode"]').attributes('aria-label'))
      .toContain('resolva pelo console do git')
  })

  it('não marca nada quando a sincronização deu certo', async () => {
    const wrapper = await mount()
    await settle(4)

    expect(wrapper.findComponent({ name: 'UChip' }).props('show')).toBe(false)
    expect(wrapper.get('[data-testid="projeto-vscode"]').attributes('aria-label')).toBe('Abrir no VS Code')
  })

  it('avisa que o remoto está indisponível sem bloquear o projeto', async () => {
    api.unavailable = true
    const wrapper = await mount()
    await settle(4)

    expect(wrapper.findComponent({ name: 'UChip' }).props('show')).toBe(true)
    expect(wrapper.findComponent({ name: 'UChip' }).props('color')).toBe('warning')
    expect(wrapper.get('[data-testid="projeto-vscode"]').attributes('aria-label'))
      .toContain('repositório remoto não respondeu')
  })

  it('filtra os cenários por título e por tag', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-busca"]').setValue('login')
    expect(wrapper.findAll('[data-testid="cenario-card"]')).toHaveLength(1)

    await wrapper.get('[data-testid="cenario-busca"]').setValue('@write')
    expect(wrapper.get('[data-testid="cenario-card"]').text()).toContain('Cadastro de produto')

    await wrapper.get('[data-testid="cenario-busca"]').setValue('')
    expect(wrapper.findAll('[data-testid="cenario-card"]')).toHaveLength(2)
  })

  it('abre o cenário clicado', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-card"]').trigger('click')

    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store/scenarios/login')
  })

  it('roda os cenários filtrados pelo grep do que está na tela', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-busca"]').setValue('login')
    await wrapper.get('[data-testid="projeto-rodar-filtrados"]').trigger('click')
    await settle()

    expect(FakeEventSource.last!.url).toContain('grep=Login+do+cliente')
    expect(field('execucao-iniciando')).toBeDefined()
  })

  it('deixa o cenário pulado fora da execução filtrada, e da contagem dela', async () => {
    api.project = project({
      scenarios: [
        scenario('Login do cliente', 'tests/login.spec.ts'),
        scenario('Mensagens de falha', 'tests/diagnostico/falhas.spec.ts', ['@read'], true)
      ]
    })
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="projeto-rodar-filtrados"]').text()).toContain('Rodar 1 filtrados')
    expect(wrapper.findAll('[data-testid="cenario-card"]'), 'o pulado continua na listagem').toHaveLength(2)

    await wrapper.get('[data-testid="projeto-rodar-filtrados"]').trigger('click')
    await settle()

    expect(FakeEventSource.last!.url).toContain('grep=Login+do+cliente')
    expect(FakeEventSource.last!.url).not.toContain('Mensagens')
  })

  it('não deixa rodar quando só sobraram cenários pulados', async () => {
    api.project = project({
      scenarios: [scenario('Mensagens de falha', 'tests/diagnostico/falhas.spec.ts', ['@read'], true)]
    })
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="projeto-rodar-filtrados"]').attributes('disabled')).toBeDefined()
  })

  it('oferece dispensar o login quando a autenticação nunca foi configurada', async () => {
    api.project = project({ auth_status: 'unset' })
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="projeto-auth-aviso"]').text()).toContain('Sem autenticação configurada')

    await wrapper.get('[data-testid="projeto-auth-dispensar"]').trigger('click')
    await settle()

    expect(api.skipped).toBe(true)
  })

  it('alerta quando a autenticação está falhando', async () => {
    api.project = project({ auth_status: 'failing' })
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="projeto-auth-falhando"]').text()).toContain('não está funcionando')
    expect(wrapper.get('[data-testid="projeto-auth-revisar"]').attributes('href'))
      .toBe('/projects/alpha-store/scenarios/auth')
  })

  it('grava um cenário simples no projeto sem login', async () => {
    api.project = project({ auth_status: 'skipped' })
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-novo"]').trigger('click')
    await settle()

    expect(useWebdriver().state.value.recording).toBe(true)
    expect(wrapper.find('[data-testid="cenario-parar"]').exists()).toBe(true)
  })

  it('não deixa gravar sem o gravador conectado', async () => {
    api.project = project({ auth_status: 'skipped' })
    connected({ connected: false })
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="cenario-novo"]').attributes('disabled')).toBeDefined()
  })

  it('para a gravação e abre a revisão quando o vídeo chega', async () => {
    api.project = project({ auth_status: 'skipped' })
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-novo"]').trigger('click')
    await wrapper.get('[data-testid="cenario-parar"]').trigger('click')
    expect(useWebdriver().state.value.recording).toBe(false)

    useWebdriver().state.value.videoSessionId = 'sessao-1'
    await settle()

    expect(field('revisao-gerar')).toBeDefined()
  })

  it('retoma a gravação do passo escolhido na revisão, mantendo os anteriores', async () => {
    api.project = project({ auth_status: 'skipped' })
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-novo"]').trigger('click')
    useWebdriver().state.value.events = [
      { type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 },
      { type: 'click', label: 'Entrar', timestamp: 2000 }
    ] as ReturnType<typeof useWebdriver>['state']['value']['events']
    await wrapper.get('[data-testid="cenario-parar"]').trigger('click')
    useWebdriver().state.value.videoSessionId = 'sessao-1'
    await settle()

    const corte = document.body.querySelector<HTMLElement>('[data-testid="revisao-retomar"]')!
    corte.click()
    await settle()
    await new Promise(resolve => setTimeout(resolve, 700))
    corte.click()
    await settle()

    expect(useWebdriver().state.value.recording).toBe(true)
    expect(useWebdriver().state.value.events).toEqual([
      { type: 'navigate', url: 'http://loja.test/login', timestamp: 1000 }
    ])
  })

  it('roda o login antes de gravar um cenário autenticado', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-busca"]').setValue('nada casa')
    await wrapper.get('[data-testid="cenario-vazio-gravar"]').trigger('click')
    await settle()

    expect(FakeEventSource.last!.url).toContain('spec=tests%2Fauth.setup.ts')
    expect(document.body.textContent).toContain('Autenticando')

    FakeEventSource.last!.send({ event: 'run:finished', passed: true, output: 'ok' })
    await settle()

    expect(useWebdriver().state.value.recording).toBe(true)
  })

  it('não abre o navegador quando o login falha', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-busca"]').setValue('nada casa')
    await wrapper.get('[data-testid="cenario-vazio-gravar"]').trigger('click')
    await settle()

    FakeEventSource.last!.send({ event: 'run:finished', passed: false, output: 'login falhou' })
    await settle()

    expect(useWebdriver().state.value.recording).toBe(false)
    expect(field('execucao-status')!.textContent).toContain('Falha')
  })

  it('mostra o erro do gravador e ensina a abrir o Chrome quando é ele que falta', async () => {
    connected({ error: 'Não encontrei o Chrome na porta 9222' })
    const wrapper = await mount()

    expect(wrapper.get('[data-testid="webdriver-erro"]').text()).toContain('Chrome')
    expect(wrapper.find('[data-testid="webdriver-comando"]').exists()).toBe(true)
  })

  it('remove o projeto depois de confirmar, e volta para a lista', async () => {
    const wrapper = await mount()

    await wrapper.get('[data-testid="projeto-remover"]').trigger('click')
    await settle()
    field('projeto-remover-confirmar')!.click()
    await settle()

    expect(api.removed).toBe(true)
    expect(navigate).toHaveBeenCalledWith('/')
  })

  it('vai para a URL nova quando o projeto é renomeado', async () => {
    const wrapper = await mount()

    wrapper.findComponent({ name: 'ProjectRenameInline' }).vm.$emit('renamed', 'loja-alpha')
    await settle()

    expect(navigate).toHaveBeenCalledWith('/projects/loja-alpha')
  })

  it('cobra a URL base no projeto que ainda não tem uma', async () => {
    api.project = project({ requires_url: true, base_url: null })
    await mount()
    await settle()

    expect(field('projeto-configuracoes-base-url')).toBeDefined()
  })

  it('abre os ambientes quando a ressalva manda para lá', async () => {
    await mount('/projects/alpha-store?environment')
    await settle()

    expect(field('ambientes-nome')).toBeDefined()
  })

  it('recarrega o projeto e o ambiente ativo depois de salvar os ambientes', async () => {
    const wrapper = await mount()

    wrapper.findComponent({ name: 'ProjectEnvironmentsSelect' }).vm.$emit('activated')
    wrapper.findComponent({ name: 'ProjectEnvironmentsModal' }).vm.$emit('saved')
    wrapper.findComponent({ name: 'ProjectSettingsModal' }).vm.$emit('saved')
    wrapper.findComponent({ name: 'ScenarioReviewModal' }).vm.$emit('generated')
    await settle()

    expect(wrapper.findAll('[data-testid="cenario-card"]')).toHaveLength(2)
  })

  it('abre os ambientes pelo atalho do seletor', async () => {
    const wrapper = await mount()

    wrapper.findComponent({ name: 'ProjectEnvironmentsSelect' }).vm.$emit('edit')
    await settle()

    expect(field('ambientes-nome')).toBeDefined()
  })

  it('grava um cenário público pelo menu de novo cenário', async () => {
    const wrapper = await mount()
    const items = wrapper.findComponent({ name: 'UDropdownMenu' }).props('items') as Array<Array<{ testid: string, onSelect: () => void }>>
    const publico = items[0]!.find(item => item.testid === 'cenario-novo-publico')!

    publico.onSelect()
    await settle()

    expect(useWebdriver().state.value.recording).toBe(true)

    // Regravar mantém o tipo escolhido: público continua público.
    useWebdriver().state.value.videoSessionId = 'sessao-1'
    await settle()
    wrapper.findComponent({ name: 'ScenarioReviewModal' }).vm.$emit('rerecord')
    await settle()

    expect(wrapper.findComponent({ name: 'ScenarioReviewModal' }).props('isPublic')).toBe(true)
  })

  it('regrava o cenário autenticado rodando o login de novo', async () => {
    const wrapper = await mount()
    const items = wrapper.findComponent({ name: 'UDropdownMenu' }).props('items') as Array<Array<{ testid: string, onSelect: () => void }>>

    items[0]!.find(item => item.testid === 'cenario-novo-autenticado')!.onSelect()
    await settle()
    expect(FakeEventSource.last!.url).toContain('spec=tests%2Fauth.setup.ts')

    FakeEventSource.last!.send({ event: 'run:finished', passed: true, output: 'ok' })
    await settle()

    useWebdriver().state.value.videoSessionId = 'sessao-2'
    await settle()
    wrapper.findComponent({ name: 'ScenarioReviewModal' }).vm.$emit('rerecord')
    await settle()

    expect(FakeEventSource.last!.url).toContain('spec=tests%2Fauth.setup.ts')
  })

  it('leva para a autenticação quando pedem correção do login que falhou', async () => {
    const wrapper = await mount()

    wrapper.findComponent({ name: 'ScenarioTestRunModal' }).vm.$emit('fix')
    await settle()

    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store/scenarios/auth')
  })

  it('fecha cada modal que a própria tela abriu', async () => {
    api.project = project({ requires_url: true })
    const wrapper = await mount('/projects/alpha-store?environment')

    await settle()

    for (const name of [
      'ProjectEnvironmentsModal',
      'ProjectSettingsModal',
      'ProjectRunFilteredModal',
      'ScenarioReviewModal',
      'ScenarioTestRunModal',
      'BaseConfirm'
    ]) {
      wrapper.findComponent({ name }).vm.$emit('update:open', false)
      await settle()
      expect(wrapper.findComponent({ name }).props('open')).toBe(false)
    }
  })

  // O 404 do projeto que não existe é verificado no E2E: montar a página sem projeto deixa o Vue
  // renderizando um estado que a rota real nunca chega a mostrar.

  it('regrava um cenário simples quando foi assim que ele foi gravado', async () => {
    api.project = project({ auth_status: 'skipped' })
    const wrapper = await mount()

    await wrapper.get('[data-testid="cenario-novo"]').trigger('click')
    useWebdriver().state.value.videoSessionId = 'sessao-3'
    await settle()

    useWebdriver().state.value.recording = false
    wrapper.findComponent({ name: 'ScenarioReviewModal' }).vm.$emit('rerecord')
    await settle()

    expect(useWebdriver().state.value.recording).toBe(true)
    expect(wrapper.findComponent({ name: 'ScenarioReviewModal' }).props('isPublic')).toBe(false)
  })

  it('começa a gravar um cenário público quando a rota pede', async () => {
    await mount('/projects/alpha-store?gravar=publico')
    await settle()

    expect(useWebdriver().state.value.recording).toBe(true)
  })

  it('roda o login antes de gravar quando a rota pede um cenário autenticado', async () => {
    await mount('/projects/alpha-store?gravar=autenticado')
    await settle()

    expect(FakeEventSource.last!.url).toContain('spec=tests%2Fauth.setup.ts')
  })
})
