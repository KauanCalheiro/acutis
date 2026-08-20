import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { defineComponent, h, nextTick, ref } from 'vue'
import { createError, readBody } from 'h3'
import SettingsModal from '~/components/settings/modal.vue'
import { extractServerError } from '~/utils/api-error'

const toasts: Array<{ title: string, color: string }> = []

vi.mock('~/composables/notify', () => ({
  useNotify: () => ({
    success: (title: string) => toasts.push({ title, color: 'success' }),
    failure: (error: unknown, fallback: string) => toasts.push({ title: extractServerError(error, fallback), color: 'error' })
  })
}))

/** Cada caso decide o que a API responde; o handler só lê daqui. */
const api = {
  settings: {
    provider: 'gemini',
    credentials: {
      'gemini': { key: 'chave-gemini', url: null, model: 'gemma-3' },
      'ollama': { key: null, url: null, model: null },
      'claude-code': { key: null, url: null, model: null },
      'codex': { key: null, url: null, model: null }
    } as Record<string, { key: string | null, url: string | null, model: string | null }>,
    providers: ['claude-code', 'codex', 'gemini', 'ollama'],
    provider_urls: { ollama: 'http://localhost:11434' } as Record<string, string>,
    keyless_providers: ['ollama', 'claude-code', 'codex']
  },
  models: [{ id: 'gemma-3', label: 'Gemma 3' }] as unknown,
  modelsStatus: 200,
  ping: { ok: true, model: 'gemma-3', elapsed_ms: 1500 } as unknown,
  pingStatus: 200,
  saveStatus: 200,
  loadStatus: 200,
  saved: null as unknown,
  requests: [] as string[]
}

function fail(status: number, message: string) {
  throw createError({ statusCode: status, data: { message } })
}

registerEndpoint('/api/settings/ai', {
  method: 'GET',
  handler: () => {
    api.requests.push('load')
    if (api.loadStatus !== 200) fail(api.loadStatus, 'Banco fora do ar')

    return api.settings
  }
})

registerEndpoint('/api/settings/ai', {
  method: 'PUT',
  handler: async (event) => {
    api.saved = await readBody(event)
    if (api.saveStatus !== 200) fail(api.saveStatus, 'Chave inválida')

    return { ok: true }
  }
})

registerEndpoint('/api/settings/ai/models', {
  method: 'POST',
  handler: async (event) => {
    api.requests.push(`models:${JSON.stringify(await readBody(event))}`)
    if (api.modelsStatus !== 200) fail(api.modelsStatus, 'Provedor fora do ar')

    return api.models
  }
})

registerEndpoint('/api/settings/ai/ping', {
  method: 'POST',
  handler: () => {
    api.requests.push('ping')
    if (api.pingStatus !== 200) fail(api.pingStatus, 'O modelo recusou a chamada')

    return api.ping
  }
})

beforeEach(() => {
  toasts.length = 0
  api.requests.length = 0
  api.saved = null
  api.modelsStatus = 200
  api.pingStatus = 200
  api.saveStatus = 200
  api.loadStatus = 200
  api.settings.provider = 'gemini'
})

afterEach(() => {
  document.body.innerHTML = ''
})

async function settle(times = 3) {
  for (let round = 0; round < times; round++) {
    await nextTick()
    await new Promise(resolve => setTimeout(resolve, 0))
  }
}

/** O modal aberto por um pai de mentira, como a navbar faz. */
async function open() {
  const state = ref(false)
  const host = defineComponent({
    setup() {
      return () => h(SettingsModal, {
        'open': state.value,
        'onUpdate:open': (value: boolean) => (state.value = value)
      })
    }
  })

  const wrapper = await mountSuspended(host)
  state.value = true
  await settle()

  return { wrapper, state }
}

function field(testid: string) {
  return [...document.body.querySelectorAll<HTMLElement>(`[data-testid="${testid}"]`)].at(-1)
}

async function type(testid: string, value: string) {
  const input = field(testid) as HTMLInputElement

  input.value = value
  input.dispatchEvent(new Event('input'))
  await settle(1)
}

/** O select do provedor não abre no jsdom; trocar pelo v-model é o mesmo caminho da tela. */
async function chooseProvider(wrapper: Awaited<ReturnType<typeof open>>['wrapper'], name: string) {
  const select = wrapper.findAllComponents({ name: 'USelect' }).at(-1)!
  select.vm.$emit('update:modelValue', name)
  await settle()
}

describe('SettingsModal', () => {
  it('abre com o provedor salvo e já busca os modelos dele', async () => {
    await open()

    expect(api.requests[0]).toBe('load')
    expect(api.requests[1]).toContain('"provider":"gemini"')
    expect(field('config-ia-modelo')).toBeDefined()
  })

  // Quem acaba de instalar abre a tela nesse estado e escolhe o provedor na mão.
  it('abre em "Sem IA" na instalação que ainda não escolheu provedor', async () => {
    api.settings.provider = ''

    await open()

    expect(api.requests).toEqual(['load'])
    expect(field('config-ia-modelo')).toBeUndefined()
    expect(field('config-ia-chave')).toBeUndefined()
  })

  it('avisa quando a configuração não carrega', async () => {
    api.loadStatus = 500

    await open()

    expect(toasts.at(-1)).toEqual({ title: 'Banco fora do ar', color: 'error' })
  })

  it('troca o cadastro ao trocar de provedor', async () => {
    const { wrapper } = await open()
    api.requests.length = 0

    await chooseProvider(wrapper, 'ollama')

    expect(field('config-ia-chave')).toBeDefined()
    expect(field('config-ia-url')?.getAttribute('placeholder')).toBe('http://localhost:11434')
    // Sem chave nem endereço guardados, não adianta perguntar os modelos ao provedor.
    expect(api.requests).toEqual([])
  })

  it('não pede credencial nenhuma para o agente local, e já lista os modelos', async () => {
    const { wrapper } = await open()
    api.requests.length = 0

    await chooseProvider(wrapper, 'claude-code')

    expect(field('config-ia-claude-agent')).toBeDefined()
    expect(field('config-ia-chave')).toBeUndefined()
    expect(api.requests.at(-1)).toContain('"provider":"claude-code"')
  })

  it('não pede credencial nenhuma para o codex, e já lista os modelos', async () => {
    const { wrapper } = await open()
    api.requests.length = 0

    await chooseProvider(wrapper, 'codex')

    expect(field('config-ia-codex')).toBeDefined()
    expect(field('config-ia-claude-agent')).toBeUndefined()
    expect(field('config-ia-chave')).toBeUndefined()
    expect(api.requests.at(-1)).toContain('"provider":"codex"')
  })

  it('desliga a IA sem pedir modelo', async () => {
    const { wrapper } = await open()

    await chooseProvider(wrapper, 'no-ai')

    expect(field('config-ia-desligada')).toBeDefined()
    expect(field('config-ia-modelo')).toBeUndefined()
  })

  it('mostra o erro do provedor que não lista os modelos', async () => {
    const { wrapper } = await open()
    api.modelsStatus = 502

    await chooseProvider(wrapper, 'ollama')
    field('config-ia-modelo-buscar')!.click()
    await settle()

    expect(document.body.textContent).toContain('Provedor fora do ar')
  })

  it('conta quanto o modelo demorou para responder', async () => {
    await open()

    field('config-ia-modelo-testar')!.click()
    await settle()

    expect(toasts.at(-1)).toEqual({ title: 'gemma-3 respondeu em 1.5s', color: 'success' })
  })

  it('avisa quando o modelo não responde', async () => {
    await open()
    api.pingStatus = 500

    field('config-ia-modelo-testar')!.click()
    await settle()

    expect(toasts.at(-1)).toEqual({ title: 'O modelo recusou a chamada', color: 'error' })
  })

  it('salva o cadastro e fecha', async () => {
    const { state } = await open()

    field('config-ia-salvar')!.click()
    await settle()

    expect(api.saved).toEqual({ provider: 'gemini', key: 'chave-gemini', url: null, model: 'gemma-3' })
    expect(state.value).toBe(false)
    expect(toasts.at(-1)).toEqual({ title: 'Configuração salva', color: 'success' })
  })

  it('grava provedor nulo quando a IA fica desligada', async () => {
    const { wrapper } = await open()
    await chooseProvider(wrapper, 'no-ai')

    field('config-ia-salvar')!.click()
    await settle()

    expect(api.saved).toMatchObject({ provider: null })
  })

  it('avisa quando o cadastro não salva, e não fecha', async () => {
    const { state } = await open()
    api.saveStatus = 422

    field('config-ia-salvar')!.click()
    await settle()

    expect(toasts.at(-1)).toEqual({ title: 'Chave inválida', color: 'error' })
    expect(state.value).toBe(true)
  })

  it('fecha sem salvar', async () => {
    const { state } = await open()

    field('config-ia-fechar')!.click()
    await settle()

    expect(state.value).toBe(false)
    expect(api.saved).toBeNull()
  })

  it('revela e esconde a chave guardada', async () => {
    await open()

    expect(field('config-ia-chave')!.getAttribute('type')).toBe('password')

    field('config-ia-chave-revelar')!.click()
    await settle()
    expect(field('config-ia-chave')!.getAttribute('type')).toBe('text')

    field('config-ia-chave-revelar')!.click()
    await settle()
    expect(field('config-ia-chave')!.getAttribute('type')).toBe('password')
  })

  it('pergunta os modelos quando o usuário termina de digitar a chave', async () => {
    const { wrapper } = await open()
    await chooseProvider(wrapper, 'ollama')
    api.requests.length = 0

    await type('config-ia-chave', 'chave-nova')
    field('config-ia-chave')!.dispatchEvent(new Event('blur'))
    await settle()

    expect(api.requests.at(-1)).toContain('"key":"chave-nova"')
  })

  it('pergunta os modelos quando o usuário termina de digitar o endereço', async () => {
    const { wrapper } = await open()
    await chooseProvider(wrapper, 'ollama')
    api.requests.length = 0

    await type('config-ia-url', 'http://caseiro.test')
    field('config-ia-url')!.dispatchEvent(new Event('blur'))
    await settle()

    expect(api.requests.at(-1)).toContain('"url":"http://caseiro.test"')
  })

  it('aceita um modelo digitado que o provedor não listou', async () => {
    const { wrapper } = await open()

    wrapper.findAllComponents({ name: 'USelectMenu' }).at(-1)!.vm.$emit('create', 'gemma-4')
    await settle()

    field('config-ia-salvar')!.click()
    await settle()

    expect(api.saved).toMatchObject({ model: 'gemma-4' })
  })

  it('guarda o modelo escolhido na lista', async () => {
    const { wrapper } = await open()

    wrapper.findAllComponents({ name: 'USelectMenu' }).at(-1)!.vm.$emit('update:modelValue', 'gemma-2')
    await settle()
    field('config-ia-salvar')!.click()
    await settle()

    expect(api.saved).toMatchObject({ model: 'gemma-2' })
  })

  it('fecha quando o próprio modal se fecha', async () => {
    const { wrapper, state } = await open()

    wrapper.findComponent({ name: 'UModal' }).vm.$emit('update:open', false)
    await settle()

    expect(state.value).toBe(false)
  })
})
