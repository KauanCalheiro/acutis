import { beforeEach, describe, expect, it } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError } from 'h3'
import ProjectRenameInline from '~/components/project/rename/inline.vue'
import { mountInApp } from '../../../support/app'
import { settle } from '../../../support/modal'

const toasts: Array<{ title: string }> = []

mockNuxtImport('useToast', () => () => ({ add: (toast: { title: string }) => toasts.push(toast) }))

const api = { status: 200, body: null as unknown }

registerEndpoint('/api/projects/alpha-store', {
  method: 'PUT',
  handler: () => {
    if (api.status !== 200) throw createError({ statusCode: api.status, data: { message: 'Nome já usado' } })

    return { slug: 'loja-alpha' }
  }
})

beforeEach(() => {
  toasts.length = 0
  api.status = 200
  api.body = null
})

async function editing() {
  const wrapper = await mountInApp(ProjectRenameInline, {
    props: { slug: 'alpha-store', name: 'Alpha Store' }
  })

  await wrapper.get('[data-testid="projeto-nome"]').trigger('click')

  return wrapper
}

describe('ProjectRenameInline', () => {
  it('mostra o nome e abre a edição no clique', async () => {
    const wrapper = await editing()

    expect((wrapper.get('[data-testid="projeto-nome-campo"]').element as HTMLInputElement).value)
      .toBe('Alpha Store')
  })

  it('renomeia e devolve o slug novo', async () => {
    const wrapper = await editing()

    await wrapper.get('[data-testid="projeto-nome-campo"]').setValue('Loja Alpha')
    await wrapper.get('[data-testid="projeto-nome-confirmar"]').trigger('click')
    await settle()

    expect(wrapper.emitted()).toBeDefined()
    expect(wrapper.findComponent(ProjectRenameInline).emitted('renamed')).toEqual([['loja-alpha']])
    expect(wrapper.find('[data-testid="projeto-nome-campo"]').exists()).toBe(false)
  })

  it('renomeia pelo enter', async () => {
    const wrapper = await editing()

    await wrapper.get('[data-testid="projeto-nome-campo"]').setValue('Loja Alpha')
    await wrapper.get('[data-testid="projeto-nome-campo"]').trigger('keydown.enter')
    await settle()

    expect(wrapper.findComponent(ProjectRenameInline).emitted('renamed')).toEqual([['loja-alpha']])
  })

  it('desiste sem chamar a API quando o nome não mudou ou ficou vazio', async () => {
    const wrapper = await editing()

    await wrapper.get('[data-testid="projeto-nome-campo"]').setValue('   ')
    await wrapper.get('[data-testid="projeto-nome-confirmar"]').trigger('click')
    await settle()

    expect(wrapper.findComponent(ProjectRenameInline).emitted('renamed')).toBeUndefined()
    expect(wrapper.get('[data-testid="projeto-nome"]').text()).toBe('Alpha Store')
  })

  it('cancela a edição pelo esc', async () => {
    const wrapper = await editing()

    await wrapper.get('[data-testid="projeto-nome-campo"]').trigger('keydown.esc')

    expect(wrapper.find('[data-testid="projeto-nome-campo"]').exists()).toBe(false)
  })

  it('cancela a edição pelo botão', async () => {
    const wrapper = await editing()

    await wrapper.get('[data-testid="projeto-nome-cancelar"]').trigger('click')

    expect(wrapper.find('[data-testid="projeto-nome-campo"]').exists()).toBe(false)
  })

  it('avisa quando o servidor recusa o nome, e continua editando', async () => {
    api.status = 422
    const wrapper = await editing()

    await wrapper.get('[data-testid="projeto-nome-campo"]').setValue('Loja Alpha')
    await wrapper.get('[data-testid="projeto-nome-confirmar"]').trigger('click')
    await settle()

    expect(toasts.at(-1)!.title).toBe('Nome já usado')
    expect(wrapper.find('[data-testid="projeto-nome-campo"]').exists()).toBe(true)
  })
})
