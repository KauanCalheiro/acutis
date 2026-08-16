/**
 * Os provedores de IA que o acutis oferece na tela de configurações, com o que cada um vale quando
 * ninguém informa nada.
 */

import { CLAUDE_AGENT_DEFAULT_MODEL } from '../../ai/providers/claude-agent.js'

export interface ProviderDefaults {
    /** O endereço usado sem cadastro. */
    url?: string
    /** O modelo sugerido quando ninguém escolheu ainda. */
    model?: string
    /** Provedor que não pede chave. */
    keyless?: boolean
    /** O que dizer quando a credencial falta, para quem não chama a dele de "chave de API". */
    keyError?: string
}

/**
 * Todo provedor listado na tela; o banco nasce com uma linha para cada um. Só entra aqui o que o
 * backend consegue chamar de verdade — ver `LANGCHAIN_PROVIDER` em `ai/providers/provider-model.ts`.
 */
export const PROVIDERS: Record<string, ProviderDefaults> = {
    anthropic: { url: process.env.ANTHROPIC_URL || 'https://api.anthropic.com/v1' },
    /**
     * O "Claude Agent" da tela. Não fala HTTP: roda o Claude Code instalado na máquina, que já está
     * autenticado, então não há endereço nem credencial para cadastrar.
     */
    'claude-code': {
        keyless: true,
        model: process.env.CLAUDE_AGENT_MODEL || CLAUDE_AGENT_DEFAULT_MODEL
    },
    gemini: { url: process.env.GEMINI_URL || 'https://generativelanguage.googleapis.com/v1beta/' },
    ollama: {
        keyless: true,
        url: process.env.OLLAMA_URL || 'http://localhost:11434',
        model: process.env.OLLAMA_MODEL || 'llama3.1:8b'
    },
    openai: { url: process.env.OPENAI_URL || 'https://api.openai.com/v1' },
    /** No OpenRouter o nome do modelo carrega o fornecedor: `qwen/qwen3-coder`. */
    openrouter: {
        url: process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1',
        model: process.env.OPENROUTER_MODEL || 'qwen/qwen3-coder'
    }
}

export const PROVIDER_NAMES = Object.keys(PROVIDERS)

/** O provedor que vale antes de alguém abrir a tela; vazio é "sem IA". */
export function providerFromEnvironment(): string {
    return process.env.AI_PROVIDER ?? 'gemini'
}

/** O endereço padrão de cada provedor que tem um. */
export function defaultProviderUrls(): Record<string, string> {
    return Object.fromEntries(
        Object.entries(PROVIDERS)
            .filter(([, defaults]) => Boolean(defaults.url))
            .map(([name, defaults]) => [name, defaults.url!])
    )
}
