// @vitest-environment node
/** A ponte entre o provedor cadastrado e o modelo que o LangGraph invoca. */
import { expect, it } from 'vitest'
import {
    ProviderUnavailable,
    chatModel,
    isNative,
    isSupported,
    supportedProviders
} from '../providers/provider-model.js'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'

function config(overrides: Partial<ResolvedProvider> = {}): ResolvedProvider {
    return { provider: 'ollama', key: null, url: null, model: 'llama3', ...overrides } as ResolvedProvider
}

it('separa o provedor nativo dos que são modelo do langchain', () => {
    expect(isNative('claude-code')).toBe(true)
    expect(isNative('ollama')).toBe(false)
})

it('sabe com quem consegue conversar', () => {
    expect(isSupported('claude-code')).toBe(true)
    expect(isSupported('openrouter')).toBe(true)
    expect(isSupported('gemini')).toBe(true)
    expect(isSupported('deepseek')).toBe(false)
})

it('lista os provedores suportados em ordem', () => {
    expect(supportedProviders()).toEqual(['anthropic', 'claude-code', 'gemini', 'ollama', 'openai', 'openrouter'])
})

it('recusa provedor que esta versão não conhece', async () => {
    await expect(chatModel(config({ provider: 'deepseek' })))
        .rejects.toThrow(ProviderUnavailable)
    await expect(chatModel(config({ provider: 'deepseek' })))
        .rejects.toThrow('ele ainda não é suportado por esta versão')
})

it('recusa montar modelo para o provedor nativo, que tem laço próprio', async () => {
    await expect(chatModel(config({ provider: 'claude-code' })))
        .rejects.toThrow('o `runAgent` o chama direto')
})

it('cobra o modelo do cadastro', async () => {
    await expect(chatModel(config({ model: null })))
        .rejects.toThrow('nenhum modelo foi informado no cadastro')
})

it('monta o openrouter pelo construtor do pacote dele', async () => {
    const model = await chatModel(config({ provider: 'openrouter', key: 'sk-or', url: 'https://openrouter.test' }))

    expect(model).toBeDefined()
    expect((model as unknown as { model: string }).model).toBe('llama3')
})

it('monta o provedor do langchain com o endereço cadastrado', async () => {
    const model = await chatModel(config({ url: 'http://caseiro.test' }))

    expect(model).toBeDefined()
})

it('monta o provedor do langchain sem endereço cadastrado', async () => {
    const model = await chatModel(config({ provider: 'openai', key: 'sk-1' }))

    expect(model).toBeDefined()
})
