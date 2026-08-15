/**
 * A ponte entre o provedor que o usuário cadastrou na tela e o modelo que o LangGraph invoca.
 *
 * O cadastro é uma linha no banco — provedor, chave, endereço e dois modelos. O LangChain resolve a
 * maioria dos provedores a partir de uma string `provedor:modelo`, então esta camada é quase só
 * tradução de nomes: o que o acutis chama de `gemini`, o LangChain chama de `google-genai`.
 *
 * Traduzir num lugar só é o que permite trocar de provedor pela interface sem que nenhum agente
 * saiba que existe mais de um.
 */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { initChatModel } from 'langchain'
import type { ResolvedProvider } from '../settings/entities/ai-settings.entity.js'

export class ProviderUnavailable extends Error {
    constructor(provider: string, reason: string) {
        super(`O provedor ${provider} não pode ser usado: ${reason}`)
        this.name = 'ProviderUnavailable'
    }
}

/**
 * O nome do provedor no acutis → o nome dele no LangChain.
 *
 * A lista da tela veio do `config/ai.php`, e alguns nomes divergem: o que lá é `gemini`, aqui é
 * `google-genai`. Provedor ausente daqui é cadastrável mas falha ao ser usado, com mensagem clara —
 * melhor do que sumir da tela e o usuário não entender por que o provedor dele não aparece.
 */
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

/**
 * O OpenRouter é a exceção: o `initChatModel` desta versão não o infere nem por prefixo nem por
 * `modelProvider` — conferido contra `langchain@1.5.8` e `@langchain/openrouter@0.4.7`. O pacote
 * dele expõe a classe direto, e é assim que ele entra.
 */
async function openRouterModel(config: ResolvedProvider, model: string): Promise<BaseChatModel> {
    const { ChatOpenRouter } = await import('@langchain/openrouter')

    // Só `apiKey` e `baseURL`: os cabeçalhos de atribuição (`HTTP-Referer`, `X-Title`) que o
    // OpenRouter usa nos rankings não são configuráveis por esta classe na versão 0.4.7.
    return new ChatOpenRouter({ model, apiKey: config.key ?? undefined, baseURL: config.url ?? undefined })
}

/** Se o acutis sabe conversar com este provedor. A tela usa para explicar por que um botão não vai. */
export function isSupported(provider: string): boolean {
    return provider === 'openrouter' || provider in LANGCHAIN_PROVIDER
}

export function supportedProviders(): string[] {
    return ['openrouter', ...Object.keys(LANGCHAIN_PROVIDER)].sort()
}

/**
 * O modelo pronto para ser invocado, ou um erro que diz o que falta preencher.
 *
 * Falha cedo e explicando: sem isto, um cadastro incompleto viraria um 401 do provedor no meio de
 * uma geração, e o usuário veria "erro ao gerar" sem saber que o problema é a chave em branco.
 */
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
        // O Ollama chama de `baseUrl`; os compatíveis com a OpenAI, de `baseURL`. Mandar os dois é
        // mais barato que manter um mapa de nome de parâmetro por provedor.
        ...(config.url ? { baseUrl: config.url, baseURL: config.url } : {})
    }) as Promise<BaseChatModel>
}
