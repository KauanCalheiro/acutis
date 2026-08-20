import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { createError, readBody } from 'h3'
import ProjectFormModal from '~/components/project/form/modal.vue'
import { field, openModal, settle, type } from '../../../support/modal'

const navigate = vi.hoisted(() => vi.fn())

mockNuxtImport('navigateTo', () => navigate)

const api = {
  createStatus: 200,
  created: null as unknown,
  cloned: null as unknown,
  probePublic: true,
  probeStatus: 200
}

registerEndpoint('/api/projects', {
  method: 'POST',
  handler: async (event) => {
    api.created = await readBody(event)
    if (api.createStatus !== 200) throw createError({ statusCode: api.createStatus, data: { message: 'Nome já existe' } })

    return { slug: 'alpha-store' }
  }
})

registerEndpoint('/api/projects/clone', {
  method: 'POST',
  handler: async (event) => {
    api.cloned = await readBody(event)
    if (api.createStatus !== 200) throw createError({ statusCode: api.createStatus, data: { message: 'Repositório não encontrado' } })

    return { slug: 'alpha-store' }
  }
})

registerEndpoint('/api/projects/probe', {
  method: 'POST',
  handler: () => {
    if (api.probeStatus !== 200) throw createError({ statusCode: api.probeStatus })

    return { public: api.probePublic }
  }
})

beforeEach(() => {
  vi.useFakeTimers()
  navigate.mockClear()
  api.createStatus = 200
  api.probeStatus = 200
  api.probePublic = true
  api.created = null
  api.cloned = null
})

afterEach(() => {
  vi.useRealTimers()
})

async function submit() {
  document.body.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await vi.advanceTimersByTimeAsync(10)
  await settle()
}

/** O debounce da sondagem da URL é de 500ms. */
async function probed() {
  await vi.advanceTimersByTimeAsync(600)
  await settle()
}

function open(tab: 'template' | 'git' = 'template') {
  return openModal(ProjectFormModal, { tab })
}

describe('ProjectFormModal', () => {
  it('cria o projeto do template e navega para ele', async () => {
    const { state } = await open()

    await type('projeto-form-nome', 'Alpha Store')
    await submit()

    expect(api.created).toEqual({ name: 'Alpha Store' })
    expect(state.value).toBe(false)
    expect(navigate).toHaveBeenCalledWith('/projects/alpha-store')
  })

  it('não cria projeto sem nome', async () => {
    await open()

    await submit()

    expect(api.created).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('mostra o que o servidor recusou, e continua aberto', async () => {
    api.createStatus = 422
    const { state } = await open()

    await type('projeto-form-nome', 'Alpha Store')
    await submit()

    expect(document.body.textContent).toContain('Nome já existe')
    expect(state.value).toBe(true)
  })

  it('reconhece o repositório público e dispensa a autenticação', async () => {
    await open('git')

    await type('projeto-form-url', 'https://github.com/acme/loja.git')
    await probed()

    expect(field('projeto-form-publico')).toBeDefined()
    expect(field('projeto-form-auth')).toBeUndefined()
  })

  it('propõe token para repositório privado em https', async () => {
    api.probePublic = false
    await open('git')

    await type('projeto-form-url', 'https://github.com/acme/privado.git')
    await probed()

    expect(field('projeto-form-token')).toBeDefined()
  })

  it('propõe chave ssh para repositório privado em ssh', async () => {
    api.probePublic = false
    await open('git')

    await type('projeto-form-url', 'git@github.com:acme/privado.git')
    await probed()

    expect(field('projeto-form-ssh')).toBeDefined()
  })

  it('clona o repositório com o que foi preenchido', async () => {
    const { state } = await open('git')

    await type('projeto-form-url', 'https://github.com/acme/loja.git')
    await probed()
    await type('projeto-form-git-nome', 'Loja Alpha')
    await type('projeto-form-branch', 'main')
    await submit()

    expect(api.cloned).toMatchObject({
      url: 'https://github.com/acme/loja.git',
      name: 'Loja Alpha',
      branch: 'main',
      auth: 'public'
    })
    expect(state.value).toBe(false)
  })

  it('segue sem sondagem quando o servidor não responde', async () => {
    api.probeStatus = 500
    await open('git')

    await type('projeto-form-url', 'https://github.com/acme/loja.git')
    await probed()

    expect(field('projeto-form-publico')).toBeUndefined()
    expect(field('projeto-form-auth')).toBeDefined()
  })

  it('aceita token e chave ssh escolhidos à mão', async () => {
    const { wrapper } = await open('git')
    const select = () => wrapper.findAllComponents({ name: 'USelect' }).at(-1)!

    select().vm.$emit('update:modelValue', 'token')
    await settle()
    await type('projeto-form-token', 'ghp_123')
    expect(field('projeto-form-token')).toBeDefined()

    select().vm.$emit('update:modelValue', 'ssh_key')
    await settle()
    await type('projeto-form-ssh', '-----BEGIN KEY-----')

    await type('projeto-form-url', 'git@github.com:acme/loja.git')
    await submit()

    expect(api.cloned).toMatchObject({ auth: 'ssh_key', ssh_key: '-----BEGIN KEY-----' })
  })

  it('some com o erro do servidor quando o usuário mexe no formulário', async () => {
    api.createStatus = 422
    await open()

    await type('projeto-form-nome', 'Alpha Store')
    await submit()
    expect(document.body.textContent).toContain('Nome já existe')

    api.createStatus = 200
    await type('projeto-form-nome', 'Alpha Store 2')
    await settle()

    expect(document.body.textContent).not.toContain('Nome já existe')
  })

  it('mantém a autenticação escolhida quando a URL não diz o protocolo', async () => {
    api.probePublic = false
    const { wrapper } = await open('git')

    wrapper.findAllComponents({ name: 'USelect' }).at(-1)!.vm.$emit('update:modelValue', 'token')
    await settle()
    await type('projeto-form-url', 'meu-repositorio-local')
    await probed()

    expect(field('projeto-form-token')).toBeDefined()
  })

  it('troca de aba pelo componente de abas', async () => {
    const { wrapper } = await open()

    wrapper.findComponent({ name: 'UTabs' }).vm.$emit('update:modelValue', 'git')
    await settle()

    expect(field('projeto-form-url')).toBeDefined()
  })

  it('fecha quando o próprio modal se fecha', async () => {
    const { wrapper, state } = await open()

    wrapper.findComponent({ name: 'UModal' }).vm.$emit('update:open', false)
    await settle()

    expect(state.value).toBe(false)
  })

  it('fecha sem criar nada', async () => {
    const { state } = await open()

    field('projeto-form-cancelar')!.click()
    await settle()

    expect(state.value).toBe(false)
    expect(api.created).toBeNull()
  })
})
