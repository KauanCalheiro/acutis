import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { nextTick, defineComponent, h } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { UApp } from '#components'
import BaseNavbar from '~/components/base/navbar.vue'
import IndexPage from '~/pages/index.vue'
import { useWalkthroughRunning, useWalkthroughSeen } from '~/composables/walkthrough'
import type { Project } from '~/types/project'
import { field, settle } from '../support/modal'

const projects: Project[] = [
  {
    name: 'Alpha Store',
    slug: 'alpha-store',
    path: '/home/user/.acutis/alpha-store',
    repository: 'git@github.com:acme/alpha-store.git',
    provider: 'github',
    created_at: '2026-01-01T00:00:00+00:00'
  },
  {
    name: 'Beta Blog',
    slug: 'beta-blog',
    path: '/home/user/.acutis/beta-blog',
    repository: null,
    provider: null,
    created_at: '2026-01-02T00:00:00+00:00'
  }
]

let response: { data: Project[], meta: { current_page: number, per_page: number, total: number } } = {
  data: projects,
  meta: {
    current_page: 1,
    per_page: 6,
    total: 2
  }
}

enableAutoUnmount(afterEach)

/** As buscas que chegaram na API, para conferir o que a tela pediu. */
const queries: string[] = []

registerEndpoint('/api/projects', (event) => {
  queries.push(event.node.req.url ?? '')

  return response
})

function listing(data: Project[], total = data.length) {
  return {
    data,
    meta: {
      current_page: 1,
      per_page: 6,
      total
    }
  }
}

describe('IndexPage', () => {
  beforeEach(() => {
    clearNuxtData()
    useWalkthroughSeen().mark('home')
  })

  it('renders a card per project from the API', async () => {
    response = {
      data: projects,
      meta: {
        current_page: 1,
        per_page: 6,
        total: 2
      }
    }

    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.findAll('[data-testid="projeto-card"]')).toHaveLength(2)
    expect(wrapper.text()).toContain('Alpha Store')
    expect(wrapper.text()).toContain('Beta Blog')
  })

  it('shows the empty state when the API returns no projects', async () => {
    response = {
      data: [],
      meta: {
        current_page: 1,
        per_page: 6,
        total: 0
      }
    }

    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.find('[data-testid="projeto-vazio"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="projeto-card"]')).toHaveLength(0)
    expect(wrapper.find('[data-testid="projeto-paginacao"]').exists()).toBe(false)
  })

  it('opens the create modal on the template tab from the empty state', async () => {
    response = {
      data: [],
      meta: {
        current_page: 1,
        per_page: 6,
        total: 0
      }
    }

    const wrapper = await mountSuspended(IndexPage)

    await wrapper.find('[data-testid="projeto-vazio-template"]').trigger('click')
    await nextTick()

    expect(document.querySelector('[data-testid="projeto-form-nome"]')).not.toBeNull()
  })

  it('opens the create modal on the git tab from the empty state', async () => {
    response = {
      data: [],
      meta: {
        current_page: 1,
        per_page: 6,
        total: 0
      }
    }

    const wrapper = await mountSuspended(IndexPage)

    await wrapper.find('[data-testid="projeto-vazio-git"]').trigger('click')
    await nextTick()

    expect(document.querySelector('[data-testid="projeto-form-url"]')).not.toBeNull()
  })
})

describe('IndexPage: busca e paginação', () => {
  beforeEach(() => {
    clearNuxtData()
    useWalkthroughSeen().mark('home')
    queries.length = 0
    vi.useFakeTimers()
    response = listing(projects, 20)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('espera o usuário parar de digitar antes de buscar', async () => {
    const wrapper = await mountSuspended(IndexPage)
    queries.length = 0

    await wrapper.get('[data-testid="projeto-busca"]').setValue('alpha')
    await vi.advanceTimersByTimeAsync(200)
    expect(queries).toHaveLength(0)

    await vi.advanceTimersByTimeAsync(200)
    expect(queries.at(-1)).toContain('search=alpha')
  })

  it('não mostra a paginação quando todos os projetos cabem numa página', async () => {
    response = listing(projects, 2)

    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.findAll('[data-testid="projeto-card"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="projeto-paginacao"]').exists()).toBe(false)
  })

  it('mostra a paginação quando os projetos não cabem numa página', async () => {
    response = listing(projects, 20)

    const wrapper = await mountSuspended(IndexPage)

    expect(wrapper.find('[data-testid="projeto-paginacao"]').exists()).toBe(true)
  })

  it('pede a página escolhida', async () => {
    response = listing(projects, 20)
    const wrapper = await mountSuspended(IndexPage)
    queries.length = 0

    await wrapper.findAll('[data-testid="projeto-paginacao"] button').at(-1)!.trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(queries.at(-1)).toContain('page%5Bnumber%5D=3')
  })
})

describe('IndexPage: frase e medida da tela', () => {
  beforeEach(() => {
    clearNuxtData()
    useWalkthroughSeen().mark('home')
    vi.useFakeTimers()
    response = listing(projects)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  function reducedMotion(reduce: boolean) {
    vi.stubGlobal('matchMedia', () => ({ matches: reduce }))
  }

  it('troca a frase de uma vez quando o usuário pediu menos movimento', async () => {
    reducedMotion(true)
    const wrapper = await mountSuspended(IndexPage)
    const first = wrapper.get('[data-testid="projeto-frase"]').text()

    await vi.advanceTimersByTimeAsync(6000)

    expect(wrapper.get('[data-testid="projeto-frase"]').text()).not.toBe(first)
  })

  it('digita a frase seguinte letra por letra', async () => {
    reducedMotion(false)
    const wrapper = await mountSuspended(IndexPage)
    const first = wrapper.get('[data-testid="projeto-frase"]').text()

    await vi.advanceTimersByTimeAsync(6000 + 25 * 60)
    const erasing = wrapper.get('[data-testid="projeto-frase"]').text()

    await vi.advanceTimersByTimeAsync(55 * 60)
    const typed = wrapper.get('[data-testid="projeto-frase"]').text()

    expect(erasing.length).toBeLessThan(first.length)
    expect(typed).not.toBe(first)
    expect(typed.length).toBeGreaterThan(1)
  })

  it('para de trocar a frase e de medir a tela quando a página sai', async () => {
    reducedMotion(true)
    const wrapper = await mountSuspended(IndexPage)
    const desligar = vi.spyOn(window, 'removeEventListener')

    wrapper.unmount()

    // O laço da frase segue vivo dentro de um `await`; ele tem que encerrar sem pintar o que saiu.
    await vi.advanceTimersByTimeAsync(12_000)

    expect(desligar).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('abre o formulário de criação pelo botão', async () => {
    reducedMotion(true)
    const wrapper = await mountSuspended(IndexPage)

    await wrapper.get('[data-testid="projeto-adicionar"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    expect(document.querySelector('[data-testid="projeto-form-nome"]')).not.toBeNull()
  })

  it('acompanha o formulário de criação quando ele mesmo se fecha', async () => {
    reducedMotion(true)
    const wrapper = await mountSuspended(IndexPage)
    const form = wrapper.findComponent({ name: 'ProjectFormModal' })

    await wrapper.get('[data-testid="projeto-adicionar"]').trigger('click')
    await vi.advanceTimersByTimeAsync(0)

    form.vm.$emit('update:open', false)
    form.vm.$emit('update:tab', 'git')
    await vi.advanceTimersByTimeAsync(0)

    expect(form.props('open')).toBe(false)
    expect(form.props('tab')).toBe('git')
  })

  it('recalcula quantos cards cabem quando a janela muda de tamanho', async () => {
    reducedMotion(true)
    const wrapper = await mountSuspended(IndexPage)

    // O happy-dom não faz layout: o teste dita as medidas que a conta usa.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({ height: 100 } as DOMRect)
    vi.stubGlobal('getComputedStyle', () => ({ rowGap: '16px', gridTemplateColumns: '1fr 1fr 1fr' }))
    vi.stubGlobal('innerHeight', 700)

    window.dispatchEvent(new Event('resize'))
    await vi.advanceTimersByTimeAsync(0)

    expect(wrapper.findAll('[data-hydrated="true"]')).toHaveLength(1)
  })
})

registerEndpoint('/api/settings/ai', () => ({
  provider: '',
  credentials: {},
  providers: ['claude-code', 'ollama'],
  provider_urls: {},
  keyless_providers: ['ollama']
}))

describe('IndexPage: apresentação', () => {
  /** Monta a tela como o app.vue monta, com a navbar ao lado, porque a apresentação passa por ela. */
  async function mountHome() {
    document.body.innerHTML = ''

    const root = document.createElement('div')
    document.body.appendChild(root)

    const host = defineComponent({
      setup() {
        return () => h(UApp, null, {
          default: () => [
            h(BaseNavbar),
            h(IndexPage)
          ]
        })
      }
    })

    await mountSuspended(host, {
      attachTo: root
    })
    await settle(5)
  }

  function walkthroughText() {
    return field('apresentacao')?.textContent ?? ''
  }

  async function advance(times: number) {
    for (let step = 0; step < times; step++) {
      const before = field('apresentacao-posicao')?.textContent

      field('apresentacao-avancar')!.click()
      await vi.waitFor(() => {
        expect(field('apresentacao-posicao')?.textContent).not.toBe(before)
      })
      await settle(3)
    }
  }

  beforeEach(() => {
    clearNuxtData()
    response = listing(projects)
    useWalkthroughSeen().reset()
    useWalkthroughRunning().value = false
  })

  it('apresenta a ferramenta na primeira visita', async () => {
    await mountHome()

    expect(walkthroughText()).toContain('Isto é o Acutis')
  })

  it('não repete a apresentação já vista', async () => {
    useWalkthroughSeen().mark('home')

    await mountHome()

    expect(field('apresentacao')).toBeUndefined()
  })

  it('explica o começar do zero com o formulário aberto na aba Template', async () => {
    await mountHome()

    await advance(2)

    expect(walkthroughText()).toContain('Começar do zero')
    expect(field('projeto-form-nome')).toBeDefined()
  })

  it('explica a importação de um Git com o formulário na aba Git', async () => {
    await mountHome()

    await advance(3)

    expect(walkthroughText()).toContain('Importar de um Git')
    expect(field('projeto-form-url')).toBeDefined()
  })

  it('fecha o formulário ao seguir para os projetos', async () => {
    await mountHome()

    await advance(4)

    expect(walkthroughText()).toContain('Cada card é um sistema')
    expect(field('projeto-form-url')).toBeUndefined()
  })

  it('deixa de fora o card quando ainda não há projeto', async () => {
    response = listing([])

    await mountHome()

    expect(field('apresentacao-posicao')?.textContent).toBe('1 de 11')
  })

  it('explica a configuração de IA com o modal aberto', async () => {
    await mountHome()

    await advance(7)

    expect(walkthroughText()).toContain('Configurações: inteligência artificial')
    expect(field('config-ia-provedor')).toBeDefined()
  })

  it('explica quando usar cada provedor', async () => {
    await mountHome()

    await advance(8)

    expect(walkthroughText()).toContain('Sem IA')
    expect(walkthroughText()).toContain('Claude Agent e Codex')
    expect(walkthroughText()).toContain('Ollama')
  })

  it('fecha as configurações ao seguir para a cor', async () => {
    await mountHome()

    await advance(9)

    expect(walkthroughText()).toContain('Cor da ferramenta')
    expect(field('config-ia-provedor')).toBeUndefined()
  })

  it('termina apontando para onde rever a apresentação', async () => {
    await mountHome()

    await advance(11)

    expect(walkthroughText()).toContain('Pronto para começar')
    expect(field('apresentacao-concluir')).toBeDefined()
  })
})
