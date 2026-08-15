/**
 * Os provedores de IA que o acutis oferece na tela de configurações, com o que cada um vale quando
 * ninguém informa nada.
 *
 * É a tradução do `config/ai.php` do Laravel, que vinha do pacote `laravel/ai`. Continua sendo uma
 * lista de dados e não de implementações de propósito: os agentes estão fora do escopo desta versão,
 * mas o cadastro do provedor é justamente o que reativa a IA depois — apagar a lista agora custaria
 * refazê-la.
 */

export interface ProviderDefaults {
    /** O endereço usado sem cadastro. A tela mostra como placeholder do campo vazio. */
    url?: string
    modelCheapest?: string
    modelSmartest?: string
    /** Provedor local não tem chave a pedir, e exigi-la travaria o cadastro dele. */
    keyless?: boolean
}

/**
 * A ordem é a mesma do `config/ai.php`, e o número de entradas importa: a tela lista todas, e o
 * banco nasce com uma linha por provedor.
 */
export const PROVIDERS: Record<string, ProviderDefaults> = {
    anthropic: { url: process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1' },
    azure: { url: process.env.AZURE_OPENAI_URL },
    bedrock: {},
    cohere: {},
    deepseek: {},
    eleven: {},
    gemini: { url: process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com/v1beta/' },
    groq: {},
    jina: {},
    mistral: {},
    ollama: {
        keyless: true,
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        modelCheapest: process.env.OLLAMA_MODEL_CHEAPEST || 'llama3.1:8b',
        modelSmartest: process.env.OLLAMA_MODEL_SMARTEST || 'llama3.1:8b'
    },
    openai: { url: process.env.OPENAI_URL || 'https://api.openai.com/v1' },
    openrouter: {},
    voyageai: {},
    xai: {}
}

export const PROVIDER_NAMES = Object.keys(PROVIDERS)

/** O provedor que vale antes de alguém abrir a tela. Vazio é "sem IA", e é um estado legítimo. */
export function providerFromEnvironment(): string {
    return process.env.AI_PROVIDER ?? 'gemini'
}

/**
 * Só os provedores que têm endereço padrão. A tela usa como placeholder, e um placeholder vazio
 * seria pior do que nenhum.
 */
export function defaultProviderUrls(): Record<string, string> {
    return Object.fromEntries(
        Object.entries(PROVIDERS)
            .filter(([, defaults]) => Boolean(defaults.url))
            .map(([name, defaults]) => [name, defaults.url!])
    )
}
