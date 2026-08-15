/**
 * A ponte entre o provedor que o usuário cadastrou na tela e o modelo que o LangGraph invoca.
 *
 * O cadastro é uma linha no banco — provedor, chave, endereço e dois modelos. O LangChain quer uma
 * classe por provedor, cada uma com o próprio nome de parâmetro (`apiKey`, `baseUrl`, `baseURL`,
 * `configuration.baseURL`…). Traduzir isso num lugar só é o que permite trocar de provedor pela
 * interface sem que nenhum agente saiba que existe mais de um.
 *
 * Os pacotes entram por import dinâmico de propósito: instalar quinze SDKs para usar um custaria
 * peso de download em todo mundo, e o app empacotado leva o `node_modules` inteiro.
 */
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import type { ResolvedProvider } from '../settings/entities/ai-settings.entity.js'

/** Qual dos dois modelos cadastrados usar. Espelha os atributos do `laravel/ai`. */
export type ModelTier = 'cheapest' | 'smartest'

export class ProviderUnavailable extends Error {
    constructor(provider: string, reason: string) {
        super(`O provedor ${provider} não pode ser usado: ${reason}`)
        this.name = 'ProviderUnavailable'
    }
}

/**
 * Como cada provedor recebe endereço e chave.
 *
 * Só existem aqui os que têm pacote instalado. Um provedor listado na tela mas ausente daqui é
 * cadastrável e falha ao ser usado, com mensagem clara — melhor do que sumir da lista e o usuário
 * não entender por que o provedor que ele usa não aparece.
 */
const BUILDERS: Record<string, (config: ResolvedProvider, model: string) => Promise<BaseChatModel>> = {
    async ollama(config, model) {
        const { ChatOllama } = await import('@langchain/ollama')

        // O Ollama é local e não pede chave; o endereço é o que importa.
        return new ChatOllama({ model, baseUrl: config.url ?? 'http://localhost:11434' })
    },

    async openai(config, model) {
        const { ChatOpenAI } = await import('@langchain/openai')

        return new ChatOpenAI({
            model,
            apiKey: config.key ?? undefined,
            configuration: config.url ? { baseURL: config.url } : undefined
        })
    },

    async anthropic(config, model) {
        const { ChatAnthropic } = await import('@langchain/anthropic')

        return new ChatAnthropic({
            model,
            apiKey: config.key ?? undefined,
            anthropicApiUrl: config.url ?? undefined
        })
    },

    async gemini(config, model) {
        const { ChatGoogleGenerativeAI } = await import('@langchain/google-genai')

        return new ChatGoogleGenerativeAI({ model, apiKey: config.key ?? undefined })
    },

    /**
     * Compatíveis com a API da OpenAI: mudam só o endereço e a chave, então reusam o mesmo cliente
     * em vez de cada um trazer um SDK próprio.
     */
    async groq(config, model) {
        return BUILDERS.openai!({ ...config, url: config.url ?? 'https://api.groq.com/openai/v1' }, model)
    },

    async deepseek(config, model) {
        return BUILDERS.openai!({ ...config, url: config.url ?? 'https://api.deepseek.com/v1' }, model)
    },

    /**
     * O OpenRouter fala a API da OpenAI, mas quer dois cabeçalhos próprios para identificar quem
     * chama — é o que ele usa nos rankings públicos e no painel de uso da conta. Sem eles a chamada
     * funciona; com eles, o uso aparece atribuído ao acutis em vez de anônimo.
     */
    async openrouter(config, model) {
        const { ChatOpenAI } = await import('@langchain/openai')

        return new ChatOpenAI({
            model,
            apiKey: config.key ?? undefined,
            configuration: {
                baseURL: config.url ?? 'https://openrouter.ai/api/v1',
                defaultHeaders: {
                    'HTTP-Referer': 'https://github.com/KauanCalheiro/acutis',
                    'X-Title': 'acutis'
                }
            }
        })
    },

    async xai(config, model) {
        return BUILDERS.openai!({ ...config, url: config.url ?? 'https://api.x.ai/v1' }, model)
    },

    async azure(config, model) {
        return BUILDERS.openai!(config, model)
    }
}

/** Se o acutis sabe conversar com este provedor. A tela usa para explicar por que um botão não vai. */
export function isSupported(provider: string): boolean {
    return provider in BUILDERS
}

export function supportedProviders(): string[] {
    return Object.keys(BUILDERS)
}

/**
 * O modelo pronto para ser invocado, ou um erro que diz o que falta preencher.
 *
 * Falha cedo e explicando: sem isto, um cadastro incompleto viraria um 401 do provedor no meio de
 * uma geração, e o usuário veria "erro ao gerar" sem saber que o problema é a chave em branco.
 */
export async function chatModel(config: ResolvedProvider, tier: ModelTier = 'cheapest'): Promise<BaseChatModel> {
    const build = BUILDERS[config.provider]

    if (!build) {
        throw new ProviderUnavailable(config.provider, 'ele ainda não é suportado por esta versão')
    }

    const model = tier === 'smartest'
        ? config.modelSmartest ?? config.modelCheapest
        : config.modelCheapest ?? config.modelSmartest

    if (!model) {
        throw new ProviderUnavailable(config.provider, 'nenhum modelo foi informado no cadastro')
    }

    return build(config, model)
}
