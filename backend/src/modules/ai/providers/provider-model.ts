/** A ponte entre o provedor que o usuário cadastrou na tela e o modelo que o LangGraph invoca. */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { initChatModel } from 'langchain'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { MAX_RETRIES } from './provider-errors.js'

export class ProviderUnavailable extends Error {
    constructor(provider: string, reason: string) {
        super(`O provedor ${provider} não pode ser usado: ${reason}`)
        this.name = 'ProviderUnavailable'
    }
}

/**
 * O nome do provedor no acutis → o nome dele no LangChain. Só entra quem tem o pacote instalado:
 * o `initChatModel` importa `@langchain/<provedor>` na hora da chamada e falha se ele não existe.
 */
const LANGCHAIN_PROVIDER: Record<string, string> = {
    anthropic: 'anthropic',
    gemini: 'google-genai',
    ollama: 'ollama',
    openai: 'openai'
}

/** O OpenRouter, que o `initChatModel` não infere e entra pela classe do pacote dele. */
async function openRouterModel(config: ResolvedProvider, model: string): Promise<BaseChatModel> {
    const { ChatOpenRouter } = await import('@langchain/openrouter')

    return new ChatOpenRouter({
        model,
        apiKey: config.key ?? undefined,
        baseURL: config.url ?? undefined,
        maxRetries: MAX_RETRIES
    })
}

/** Quem o `initChatModel` não monta, e traz o próprio construtor. */
const CUSTOM_MODEL: Record<string, (config: ResolvedProvider, model: string) => Promise<BaseChatModel>> = {
    openrouter: openRouterModel
}

/**
 * Provedores que não são um modelo do LangChain: têm laço próprio e o `runAgent` os chama direto.
 * O Claude Code e o Codex são processos locais, não endpoints.
 */
const NATIVE = ['claude-code', 'codex']

export function isNative(provider: string): boolean {
    return NATIVE.includes(provider)
}

/** Se o acutis sabe conversar com este provedor. */
export function isSupported(provider: string): boolean {
    return isNative(provider) || provider in CUSTOM_MODEL || provider in LANGCHAIN_PROVIDER
}

export function supportedProviders(): string[] {
    return [...NATIVE, ...Object.keys(CUSTOM_MODEL), ...Object.keys(LANGCHAIN_PROVIDER)].sort()
}

/** O modelo pronto para ser invocado, ou um erro que diz o que falta preencher no cadastro. */
export async function chatModel(config: ResolvedProvider): Promise<BaseChatModel> {
    if (!isSupported(config.provider)) {
        throw new ProviderUnavailable(config.provider, 'ele ainda não é suportado por esta versão')
    }

    if (isNative(config.provider)) {
        throw new ProviderUnavailable(config.provider, 'ele não é um modelo do LangChain; o `runAgent` o chama direto')
    }

    const model = config.model

    if (!model) {
        throw new ProviderUnavailable(config.provider, 'nenhum modelo foi informado no cadastro')
    }

    const custom = CUSTOM_MODEL[config.provider]

    if (custom) return custom(config, model)

    return initChatModel(model, {
        modelProvider: LANGCHAIN_PROVIDER[config.provider],
        apiKey: config.key ?? undefined,
        maxRetries: MAX_RETRIES,
        // O Ollama chama de `baseUrl`; os compatíveis com a OpenAI, de `baseURL`.
        ...(config.url ? { baseUrl: config.url, baseURL: config.url } : {})
    }) as Promise<BaseChatModel>
}
