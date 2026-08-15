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
    /** O modelo sugerido quando ninguém escolheu ainda. A tela usa como placeholder. */
    model?: string
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
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b'
    },
    openai: { url: process.env.OPENAI_URL || 'https://api.openai.com/v1' },
    /**
     * O OpenRouter serve centenas de modelos atrás de uma API compatível com a da OpenAI, e o nome
     * do modelo carrega o fornecedor: `anthropic/claude-3.5-sonnet`, `qwen/qwen3-coder`. Sem um
     * padrão razoável aqui, o campo nasceria vazio e o primeiro uso falharia por modelo em branco.
     */
    openrouter: {
        url: process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-coder'
    },
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
