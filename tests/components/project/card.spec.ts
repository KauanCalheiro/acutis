import { describe, it, expect, vi } from 'vitest'
import { mountSuspended, mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import ProjectCard from '~/components/project/card.vue'
import { mountInApp } from '../../support/app'
import { field, settle } from '../../support/modal'
import type { Project } from '~/types/project'

interface MenuItem {
  testid?: string
  to?: string
  onSelect?: () => unknown
}

const navigate = vi.hoisted(() => vi.fn())

mockNuxtImport('navigateTo', () => navigate)

let removed = false
let removalFails = false

registerEndpoint('/api/projects/alpha-store', {
  method: 'DELETE',
  handler: () => {
    if (removalFails) throw createError({ statusCode: 500 })

    removed = true

    return { ok: true }
  }
})

const project: Project = {
  name: 'Alpha Store',
  slug: 'alpha-store',
  path: '/home/user/.acutis/alpha-store',
  repository: 'git@github.com:acme/alpha-store.git',
  provider: 'github',
  created_at: '2026-01-01T00:00:00+00:00'
}

describe('ProjectCard', () => {
  it('renders name, path and provider badge', async () => {
    const wrapper = await mountSuspended(ProjectCard, {
      props: {
        project
      }
    })

    expect(wrapper.text()).toContain('Alpha Store')
    expect(wrapper.text()).toContain('/home/user/.acutis/alpha-store')
    expect(wrapper.find('[title]').attributes('title')).toBe('git@github.com:acme/alpha-store.git')
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

describe('ProjectCard menu de contexto', () => {
  const items = (wrapper: { findComponent: (o: object) => { props: (name: string) => unknown } }) =>
    (wrapper.findComponent({ name: 'UContextMenu' }).props('items') as MenuItem[][]).flat()

  const item = (wrapper: Awaited<ReturnType<typeof mountInApp>>, testid: string) =>
    items(wrapper).find(entry => entry.testid === testid)!

  it('leva para o projeto e para a gravação de cada tipo de cenário', async () => {
    const wrapper = await mountInApp(ProjectCard, { props: { project } })

    item(wrapper, 'projeto-menu-acessar').onSelect!()
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store')

    item(wrapper, 'projeto-menu-relatorio').onSelect!()
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store/report')

    item(wrapper, 'projeto-menu-gravar-publico').onSelect!()
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store?gravar=publico')

    item(wrapper, 'projeto-menu-gravar-autenticado').onSelect!()
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store?gravar=autenticado')
  })

  it('abre o projeto no vs code pelo caminho absoluto', async () => {
    const wrapper = await mountInApp(ProjectCard, { props: { project } })

    expect(item(wrapper, 'projeto-menu-vscode').to).toBe('vscode://file/home/user/.acutis/alpha-store')
  })

  it('copia o caminho absoluto do projeto', async () => {
    const writeText = vi.fn()
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const wrapper = await mountInApp(ProjectCard, { props: { project } })
    await item(wrapper, 'projeto-menu-copiar').onSelect!()

    expect(writeText).toHaveBeenCalledWith('/home/user/.acutis/alpha-store')

    vi.unstubAllGlobals()
  })

  it('avisa quando a API recusa remover o projeto', async () => {
    removalFails = true
    const wrapper = await mountInApp(ProjectCard, { props: { project } })

    item(wrapper, 'projeto-menu-remover').onSelect!()
    await settle()

    field('projeto-remover-confirmar')!.click()
    await settle()

    expect(document.body.textContent).toContain('Não foi possível remover o projeto.')

    removalFails = false
    document.body.innerHTML = ''
  })

  it('remove o projeto depois da confirmação', async () => {
    removed = false
    const wrapper = await mountInApp(ProjectCard, { props: { project } })

    item(wrapper, 'projeto-menu-remover').onSelect!()
    await settle()

    field('projeto-remover-confirmar')!.click()
    await settle()

    expect(removed).toBe(true)
    expect(wrapper.findComponent(ProjectCard).emitted('removed')).toHaveLength(1)

    document.body.innerHTML = ''
  })
})
