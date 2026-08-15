/** A ponte entre o provedor que o usuário cadastrou na tela e o modelo que o LangGraph invoca. */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { initChatModel } from 'langchain'
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'

export class ProviderUnavailable extends Error {
    constructor(provider: string, reason: string) {
        super(`O provedor ${provider} não pode ser usado: ${reason}`)
        this.name = 'ProviderUnavailable'
    }
}

/** O nome do provedor no acutis → o nome dele no LangChain. */
const LANGCHAIN_PROVIDER: Record<string, string> = {
    anthropic: 'anthropic',
    azure: 'azure_openai',
    bedrock: 'bedrock',
    cohere: 'cohere',
    deepseek: 'deepseek',
    gemini: 'google-genai',
    groq: 'groq',
    mistral: 'mistralai',
    ollama: 'ollama',
    openai: 'openai',
    xai: 'xai'
}

/** O OpenRouter, que o `initChatModel` não infere e entra pela classe do pacote dele. */
async function openRouterModel(config: ResolvedProvider, model: string): Promise<BaseChatModel> {
    const { ChatOpenRouter } = await import('@langchain/openrouter')

    return new ChatOpenRouter({ model, apiKey: config.key ?? undefined, baseURL: config.url ?? undefined })
}

/** Se o acutis sabe conversar com este provedor. */
export function isSupported(provider: string): boolean {
    return provider === 'openrouter' || provider in LANGCHAIN_PROVIDER
}

export function supportedProviders(): string[] {
    return ['openrouter', ...Object.keys(LANGCHAIN_PROVIDER)].sort()
}

/** O modelo pronto para ser invocado, ou um erro que diz o que falta preencher no cadastro. */
export async function chatModel(config: ResolvedProvider): Promise<BaseChatModel> {
    if (!isSupported(config.provider)) {
        throw new ProviderUnavailable(config.provider, 'ele ainda não é suportado por esta versão')
    }

    const model = config.model

    if (!model) {
        throw new ProviderUnavailable(config.provider, 'nenhum modelo foi informado no cadastro')
    }

    if (config.provider === 'openrouter') return openRouterModel(config, model)

    return initChatModel(model, {
        modelProvider: LANGCHAIN_PROVIDER[config.provider],
        apiKey: config.key ?? undefined,
        // O Ollama chama de `baseUrl`; os compatíveis com a OpenAI, de `baseURL`.
        ...(config.url ? { baseUrl: config.url, baseURL: config.url } : {})
    }) as Promise<BaseChatModel>
}
