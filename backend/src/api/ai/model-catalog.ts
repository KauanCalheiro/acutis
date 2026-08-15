/**
 * Os modelos que um provedor oferece, perguntados a ele.
 *
 * Digitar o nome do modelo à mão é a fonte mais comum de erro no cadastro: o nome muda com o tempo
 * (`gpt-4o` vira `gpt-4o-2024-11-20`), varia por conta (o Ollama só tem o que foi baixado) e um erro
 * de digitação só aparece na primeira geração, como um 404 do provedor.
 *
 * Cada provedor expõe isso de um jeito, e traduzir num lugar só é o que permite à tela mostrar uma
 * lista para escolher, em vez de um campo de texto livre.
 */
import type { ResolvedProvider } from '../settings/entities/ai-settings.entity.js'

export interface AvailableModel {
    /** O identificador que vai no cadastro, exatamente como o provedor o nomeia. */
    id: string
    /** O que a tela mostra. Igual ao id quando o provedor não dá nada melhor. */
    label: string
}

export class ModelListingFailed extends Error {
    constructor(provider: string, reason: string) {
        super(`Não foi possível listar os modelos de ${provider}: ${reason}`)
        this.name = 'ModelListingFailed'
    }
}

/** Quanto esperar pela lista. Ela abre um campo na tela, então demorar é pior que falhar. */
const TIMEOUT_MS = 10_000

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
    const response = await fetch(url, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) })

    if (!response.ok) {
        throw new Error(`o provedor respondeu ${response.status}`)
    }

    return response.json()
}

function trimSlash(url: string): string {
    return url.replace(/\/+$/, '')
}

/** O formato da OpenAI, que os compatíveis também falam: `{ data: [{ id }] }`. */
async function openAiCompatible(base: string, key: string | null): Promise<AvailableModel[]> {
    const body = await fetchJson(`${trimSlash(base)}/models`, key ? { Authorization: `Bearer ${key}` } : {})
    const list = (body as { data?: { id?: string }[] }).data ?? []

    return list.filter((item) => item.id).map((item) => ({ id: item.id!, label: item.id! }))
}

const CATALOGS: Record<string, (config: ResolvedProvider) => Promise<AvailableModel[]>> = {
    /** Local: lista o que foi baixado na máquina, e por isso nunca pede chave. */
    async ollama(config) {
        const base = trimSlash(config.url ?? 'http://localhost:11434')
        const body = await fetchJson(`${base}/api/tags`)
        const list = (body as { models?: { name?: string, size?: number }[] }).models ?? []

        return list.filter((model) => model.name).map((model) => ({
            id: model.name!,
            // O tamanho ajuda a escolher: num servidor modesto, um modelo de 30 GB não roda.
            label: model.size
                ? `${model.name} · ${(model.size / 1e9).toFixed(1)} GB`
                : model.name!
        }))
    },

    openai: (config) => openAiCompatible(config.url ?? 'https://api.openai.com/v1', config.key),
    groq: (config) => openAiCompatible(config.url ?? 'https://api.groq.com/openai/v1', config.key),
    deepseek: (config) => openAiCompatible(config.url ?? 'https://api.deepseek.com/v1', config.key),
    xai: (config) => openAiCompatible(config.url ?? 'https://api.x.ai/v1', config.key),
    azure: (config) => openAiCompatible(config.url ?? '', config.key),

    /** O OpenRouter devolve centenas; o `name` dele é mais legível que o id. */
    async openrouter(config) {
        const base = trimSlash(config.url ?? 'https://openrouter.ai/api/v1')
        const body = await fetchJson(`${base}/models`)
        const list = (body as { data?: { id?: string, name?: string }[] }).data ?? []

        return list.filter((item) => item.id).map((item) => ({
            id: item.id!,
            label: item.name ?? item.id!
        }))
    },

    async anthropic(config) {
        const base = trimSlash(config.url ?? 'https://api.anthropic.com/v1')
        const body = await fetchJson(`${base}/models`, {
            'x-api-key': config.key ?? '',
            'anthropic-version': '2023-06-01'
        })
        const list = (body as { data?: { id?: string, display_name?: string }[] }).data ?? []

        return list.filter((item) => item.id).map((item) => ({
            id: item.id!,
            label: item.display_name ?? item.id!
        }))
    },

    /** O Gemini nomeia como `models/gemini-2.0-flash`; o cadastro quer só a parte final. */
    async gemini(config) {
        const base = trimSlash(config.url ?? 'https://generativelanguage.googleapis.com/v1beta')
        const body = await fetchJson(`${base}/models?key=${encodeURIComponent(config.key ?? '')}`)
        const list = (body as { models?: { name?: string, displayName?: string, supportedGenerationMethods?: string[] }[] }).models ?? []

        return list
            // Sem `generateContent` o modelo é de embedding ou de contagem de tokens, e escolhê-lo
            // aqui daria erro só na primeira geração.
            .filter((model) => model.name && (model.supportedGenerationMethods ?? []).includes('generateContent'))
            .map((model) => ({
                id: model.name!.replace(/^models\//, ''),
                label: model.displayName ?? model.name!.replace(/^models\//, '')
            }))
    }
}

export function canListModels(provider: string): boolean {
    return provider in CATALOGS
}

/**
 * Os modelos do provedor, em ordem alfabética.
 *
 * Falha com o motivo à mostra: chave errada é 401, endereço errado é recusa de conexão, e a tela
 * precisa dizer qual dos dois foi para o usuário saber o que corrigir.
 */
export async function listModels(config: ResolvedProvider): Promise<AvailableModel[]> {
    const catalog = CATALOGS[config.provider]

    if (!catalog) {
        throw new ModelListingFailed(config.provider, 'ele não oferece uma lista de modelos')
    }

    try {
        const models = await catalog(config)

        return models.sort((a, b) => a.id.localeCompare(b.id))
    } catch (error) {
        const reason = error instanceof Error ? error.message : String(error)

        throw new ModelListingFailed(config.provider, reason)
    }
}
