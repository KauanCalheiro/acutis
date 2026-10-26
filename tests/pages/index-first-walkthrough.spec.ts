import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData, clearNuxtState } from 'nuxt/app'
import { defineComponent, h } from 'vue'
import { enableAutoUnmount } from '@vue/test-utils'
import { UApp } from '#components'
import BaseNavbar from '~/components/base/navbar.vue'
import IndexPage from '~/pages/index.vue'
import { FIRST_WALKTHROUGH } from '~/composables/first-walkthrough'
import { useWalkthroughRunning, useWalkthroughSeen } from '~/composables/walkthrough'
import type { Project } from '~/types/project'
import { field, settle } from '../support/modal'

function projectFactory(overrides: Partial<Project> = {}): Project {
  return {
    name: 'Minha Loja',
    slug: 'minha-loja',
    path: '/home/user/.acutis/minha-loja',
    repository: null,
    provider: null,
    created_at: '2026-01-01T00:00:00+00:00',
    demo: false,
    ...overrides
  }
}

function demoFactory(): Project {
  return projectFactory({
    name: 'Swag Labs',
    slug: 'swag-labs',
    path: '/home/user/.acutis/swag-labs',
    demo: true
  })
}

const api = {
  projects: [] as Project[],
  created: 0,
  revoked: 0
}

registerEndpoint('/api/projects', () => ({
  data: api.projects,
  meta: {
    current_page: 1,
    per_page: 9,
    total: api.projects.length
  }
}))

registerEndpoint('/api/demo', {
  method: 'POST',
  handler: () => {
    api.created++
    api.projects = [demoFactory()]

    return api.projects[0]
  }
})

registerEndpoint('/api/demo', {
  method: 'DELETE',
  handler: () => {
    api.revoked++
    api.projects = api.projects.filter(project => !project.demo)

    return null
  }
})

enableAutoUnmount(afterEach)

/** Monta a home como o app.vue monta, com a navbar ao lado, porque a apresentação passa por ela. */
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

  const wrapper = await mountSuspended(host, {
    attachTo: root
  })
  await settle(5)

  return wrapper
}

function walkthroughText() {
  return field('apresentacao')?.textContent ?? ''
}

describe('IndexPage: apresentação inicial com o projeto de exemplo', () => {
  beforeEach(async () => {
    await navigateTo('/')
    clearNuxtData()
    clearNuxtState([
      'first-walkthrough-progress',
      'first-walkthrough-creating'
    ])
    api.projects = []
    api.created = 0
    api.revoked = 0
    useWalkthroughSeen().reset()
    useWalkthroughRunning().value = false
  })

  it('cria o exemplo na primeira visita sem projetos', async () => {
    await mountHome()

    expect(api.created).toBe(1)
  })

  it('abre a apresentação inicial com o exemplo na lista', async () => {
    const wrapper = await mountHome()

    await vi.waitFor(() => {
      expect(walkthroughText()).toContain('Isto é o Acutis')
    })
    expect(wrapper.text()).toContain('Swag Labs')
  })

  it('não cria o exemplo para quem já tem projeto', async () => {
    api.projects = [projectFactory()]

    await mountHome()

    expect(api.created).toBe(0)
  })

  it('não cria o exemplo quando a apresentação inicial já foi vista', async () => {
    useWalkthroughSeen().mark(FIRST_WALKTHROUGH)

    const wrapper = await mountHome()

    expect(api.created).toBe(0)
    expect(wrapper.find('[data-testid="projeto-vazio"]').exists()).toBe(true)
  })

  it('retoma a apresentação inicial quando o exemplo ficou de uma visita anterior', async () => {
    api.projects = [demoFactory()]

    await mountHome()

    await vi.waitFor(() => {
      expect(field('apresentacao-capitulo')?.textContent).toContain('Parte 1 de 6')
    })
  })

  it('remove o exemplo ao pular a apresentação inicial', async () => {
    await mountHome()
    await vi.waitFor(() => {
      expect(field('apresentacao-pular')).toBeDefined()
    })

    field('apresentacao-pular')!.click()

    await vi.waitFor(() => {
      expect(api.revoked).toBe(1)
    })
  })

  it('mostra a home vazia depois de pular a apresentação inicial', async () => {
    const wrapper = await mountHome()
    await vi.waitFor(() => {
      expect(wrapper.text()).toContain('Swag Labs')
      expect(field('apresentacao-pular')).toBeDefined()
    })

    field('apresentacao-pular')!.click()

    await vi.waitFor(() => {
      expect(wrapper.find('[data-testid="projeto-vazio"]').exists()).toBe(true)
    })
  })

  it('segue para a tela do projeto ao terminar a parte da home', async () => {
    await mountHome()
    await vi.waitFor(() => {
      expect(field('apresentacao-capitulo')).toBeDefined()
    })

    while (field('apresentacao-avancar')) {
      field('apresentacao-avancar')!.click()
      await settle(3)
    }

    await vi.waitFor(() => {
      expect(useRouter().currentRoute.value.path).toBe('/projects/swag-labs')
    })
  })

  it('recria o exemplo ao rever a apresentação sem projetos', async () => {
    useWalkthroughSeen().mark(FIRST_WALKTHROUGH)
    await mountHome()

    field('navbar-apresentacao')!.click()

    await vi.waitFor(() => {
      expect(api.created).toBe(1)
    })
  })
})
