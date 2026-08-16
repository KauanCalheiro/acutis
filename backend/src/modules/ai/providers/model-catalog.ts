/** Os modelos que um provedor oferece, perguntados a ele e traduzidos para uma lista só. */
import type { ResolvedProvider } from '../../settings/entities/ai-settings.entity.js'
import { CLAUDE_AGENT_MODELS } from './claude-agent.js'

export interface AvailableModel {
    /** O identificador que vai no cadastro, exatamente como o provedor o nomeia. */
    id: string
    /** O que a tela mostra. */
    label: string
}

export class ModelListingFailed extends Error {
    constructor(provider: string, reason: string) {
        super(`Não foi possível listar os modelos de ${provider}: ${reason}`)
        this.name = 'ModelListingFailed'
    }
}

/** Quanto esperar pela lista antes de desistir. */
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

/** O catálogo da Anthropic; quem autentica muda, o resto é igual. Cabeçalho nulo não vai. */
async function anthropicCatalog(config: ResolvedProvider, auth: Record<string, string | null>): Promise<AvailableModel[]> {
    const base = trimSlash(config.url ?? 'https://api.anthropic.com/v1')
    const headers = Object.fromEntries(Object.entries(auth).filter(([, value]) => value !== null)) as Record<string, string>
    const body = await fetchJson(`${base}/models`, { ...headers, 'anthropic-version': '2023-06-01' })
    const list = (body as { data?: { id?: string, display_name?: string }[] }).data ?? []

    return list.filter((item) => item.id).map((item) => ({
        id: item.id!,
        label: item.display_name ?? item.id!
    }))
}

const CATALOGS: Record<string, (config: ResolvedProvider) => Promise<AvailableModel[]>> = {
    /** O Ollama lista o que foi baixado na máquina, e não pede chave. */
    async ollama(config) {
        const base = trimSlash(config.url ?? 'http://localhost:11434')
        const body = await fetchJson(`${base}/api/tags`)
        const list = (body as { models?: { name?: string, size?: number }[] }).models ?? []

        return list.filter((model) => model.name).map((model) => ({
            id: model.name!,
            label: model.size
                ? `${model.name} · ${(model.size / 1e9).toFixed(1)} GB`
                : model.name!
        }))
    },

    openai: (config) => openAiCompatible(config.url ?? 'https://api.openai.com/v1', config.key),

    /** O OpenRouter, que rotula pelo `name` em vez do id. */
    async openrouter(config) {
        const base = trimSlash(config.url ?? 'https://openrouter.ai/api/v1')
        const body = await fetchJson(`${base}/models`)
        const list = (body as { data?: { id?: string, name?: string }[] }).data ?? []

        return list.filter((item) => item.id).map((item) => ({
            id: item.id!,
            label: item.name ?? item.id!
        }))
    },

    anthropic: (config) => anthropicCatalog(config, { 'x-api-key': config.key ?? '' }),

    /** O Claude Code não oferece catálogo: a lista é a que este projeto verificou. */
    'claude-code': async () => CLAUDE_AGENT_MODELS.map((id) => ({ id, label: id })),

    /** O Gemini nomeia como `models/gemini-2.0-flash`; o cadastro quer só a parte final. */
    async gemini(config) {
        const base = trimSlash(config.url ?? 'https://generativelanguage.googleapis.com/v1beta')
        const body = await fetchJson(`${base}/models?key=${encodeURIComponent(config.key ?? '')}`)
        const list = (body as { models?: { name?: string, displayName?: string, supportedGenerationMethods?: string[] }[] }).models ?? []

        return list
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

/** Os modelos do provedor, em ordem alfabética; falha com o motivo à mostra. */
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
