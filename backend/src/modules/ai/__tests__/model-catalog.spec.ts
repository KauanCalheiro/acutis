// @vitest-environment node
/** A lista de modelos de cada provedor, perguntada a ele e traduzida para uma lista só. */
import { afterEach, expect, it, vi } from 'vitest'
import { CLAUDE_AGENT_MODELS } from '../providers/claude-agent.js'
import { ModelListingFailed, canListModels, listModels } from '../providers/model-catalog.js'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'

/** As URLs pedidas, para conferir contra qual endereço o catálogo foi perguntado. */
let asked: { url: string, headers: Record<string, string> }[] = []

function answering(payload: unknown, ok = true, status = 200): void {
    asked = []
    vi.stubGlobal('fetch', (url: string, init: { headers?: Record<string, string> } = {}) => {
        asked.push({ url, headers: init.headers ?? {} })

        return Promise.resolve({
            ok,
            status,
            json: () => Promise.resolve(payload)
        })
    })
}

function config(overrides: Partial<ResolvedProvider> = {}): ResolvedProvider {
    return { provider: 'ollama', key: null, url: null, model: null, ...overrides } as ResolvedProvider
}

afterEach(() => {
    vi.unstubAllGlobals()
})

it('sabe quem oferece lista de modelos', () => {
    expect(canListModels('ollama')).toBe(true)
    expect(canListModels('deepseek')).toBe(false)
})

it('lista o que o ollama baixou, com o tamanho no rótulo', async () => {
    answering({ models: [{ name: 'llama3', size: 4.7e9 }, { name: 'gemma' }, { size: 1 }] })

    expect(await listModels(config())).toEqual([
        { id: 'gemma', label: 'gemma' },
        { id: 'llama3', label: 'llama3 · 4.7 GB' }
    ])
    expect(asked[0]!.url).toBe('http://localhost:11434/api/tags')
})

it('pergunta ao endereço cadastrado, sem barra sobrando', async () => {
    answering({ models: [{ name: 'llama3' }] })

    await listModels(config({ url: 'http://caseiro.test/' }))

    expect(asked[0]!.url).toBe('http://caseiro.test/api/tags')
})

it('lista o formato da openai com a chave no cabeçalho', async () => {
    answering({ data: [{ id: 'gpt-5' }, { id: 'gpt-4' }, {}] })

    expect(await listModels(config({ provider: 'openai', key: 'sk-1' }))).toEqual([
        { id: 'gpt-4', label: 'gpt-4' },
        { id: 'gpt-5', label: 'gpt-5' }
    ])
    expect(asked[0]!.url).toBe('https://api.openai.com/v1/models')
    expect(asked[0]!.headers).toEqual({ Authorization: 'Bearer sk-1' })
})

it('não manda cabeçalho de autenticação sem chave', async () => {
    answering({ data: [{ id: 'gpt-5' }] })

    await listModels(config({ provider: 'openai' }))

    expect(asked[0]!.headers).toEqual({})
})

it('rotula o openrouter pelo nome que ele dá', async () => {
    answering({ data: [{ id: 'anthropic/claude', name: 'Claude' }, { id: 'x/y' }] })

    expect(await listModels(config({ provider: 'openrouter' }))).toEqual([
        { id: 'anthropic/claude', label: 'Claude' },
        { id: 'x/y', label: 'x/y' }
    ])
})

it('rotula a anthropic pelo nome de exibição e manda a versão da api', async () => {
    answering({ data: [{ id: 'claude-opus', display_name: 'Claude Opus' }, { id: 'claude-haiku' }] })

    expect(await listModels(config({ provider: 'anthropic', key: 'sk-ant' }))).toEqual([
        { id: 'claude-haiku', label: 'claude-haiku' },
        { id: 'claude-opus', label: 'Claude Opus' }
    ])
    expect(asked[0]!.headers).toEqual({ 'x-api-key': 'sk-ant', 'anthropic-version': '2023-06-01' })
})

it('lista o catálogo fixo do agente local, sem perguntar a ninguém', async () => {
    answering({})

    expect(await listModels(config({ provider: 'claude-code' })))
        .toEqual([...CLAUDE_AGENT_MODELS].sort().map(id => ({ id, label: id })))
    expect(asked).toEqual([])
})

it('tira o prefixo do gemini e ignora modelo que não gera conteúdo', async () => {
    answering({
        models: [
            { name: 'models/gemini-2.0-flash', displayName: 'Gemini Flash', supportedGenerationMethods: ['generateContent'] },
            { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
            { name: 'models/gemma-3', supportedGenerationMethods: ['generateContent'] }
        ]
    })

    expect(await listModels(config({ provider: 'gemini', key: 'chave' }))).toEqual([
        { id: 'gemini-2.0-flash', label: 'Gemini Flash' },
        { id: 'gemma-3', label: 'gemma-3' }
    ])
    expect(asked[0]!.url).toContain('?key=chave')
})

it('devolve lista vazia quando o provedor não manda modelo nenhum', async () => {
    answering({})

    expect(await listModels(config())).toEqual([])
    expect(await listModels(config({ provider: 'openai' }))).toEqual([])
    expect(await listModels(config({ provider: 'openrouter' }))).toEqual([])
    expect(await listModels(config({ provider: 'anthropic' }))).toEqual([])
    expect(await listModels(config({ provider: 'gemini' }))).toEqual([])
})

it('explica o status com que o provedor recusou', async () => {
    answering({}, false, 401)

    await expect(listModels(config())).rejects.toThrow(ModelListingFailed)
    await expect(listModels(config())).rejects.toThrow('o provedor respondeu 401')
})

it('explica a falha que não é um erro', async () => {
    vi.stubGlobal('fetch', () => Promise.reject('caiu'))

    await expect(listModels(config())).rejects.toThrow('caiu')
})

it('recusa provedor que não tem catálogo', async () => {
    await expect(listModels(config({ provider: 'deepseek' })))
        .rejects.toThrow('ele não oferece uma lista de modelos')
})
