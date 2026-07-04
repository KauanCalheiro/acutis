import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ProjectCard from '~/components/project/card.vue'
import type { Project } from '~/types/project'

const project: Project = {
  name: 'Alpha Store',
  slug: 'alpha-store',
  path: '/home/user/.acutis/alpha-store',
  repository: 'git@github.com:acme/alpha-store.git',
  provider: 'github',
  created_at: '2026-01-01T00:00:00+00:00'
}

describe('ProjectCard', () => {
  it('renders name, repository and provider badge', async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: {
        project
      }
    })

    expect(wrapper.text()).toContain('Alpha Store')
    expect(wrapper.text()).toContain('git@github.com:acme/alpha-store.git')
    expect(wrapper.text()).toContain('GitHub')
  })

  it('falls back to path when repository is null', async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: {
        project: {
          ...project,
          repository: null,
          provider: null
        }
      }
    })

    expect(wrapper.text()).toContain('/home/user/.acutis/alpha-store')
  })

  it('omits provider badge when provider is null', async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: {
        project: {
          ...project,
          provider: null
        }
      }
    })

    expect(wrapper.text()).not.toContain('GitHub')
  })
})
