import { describe, it, expect, beforeEach } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { clearNuxtData } from 'nuxt/app'
import { nextTick } from 'vue'
import IndexPage from '~/pages/index.vue'
import type { Project } from '~/types/project'

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

registerEndpoint('/api/projects', () => response)

describe('IndexPage', () => {
  beforeEach(() => {
    clearNuxtData()
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
