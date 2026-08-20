/**
 * Os provedores de IA que o acutis oferece na tela de configurações, com o que cada um vale quando
 * ninguém informa nada.
 */

import { CLAUDE_AGENT_DEFAULT_MODEL } from '../../ai/providers/claude-agent.js'
import { CODEX_DEFAULT_MODEL } from '../../ai/providers/codex-agent.js'
import { APP_CONFIG, processEnvironment } from '../../../config/env.js'

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
  'anthropic': { url: APP_CONFIG.providers.anthropicUrl },
  /**
     * O "Claude Agent" da tela. Não fala HTTP: roda o Claude Code instalado na máquina, que já está
     * autenticado, então não há endereço nem credencial para cadastrar.
     */
  'claude-code': {
    keyless: true,
    model: APP_CONFIG.providers.claudeAgentModel ?? CLAUDE_AGENT_DEFAULT_MODEL
  },
  /**
     * O "Codex" da tela. Também não fala HTTP: roda o Codex instalado na máquina, que já está
     * autenticado pela assinatura ChatGPT.
     */
  'codex': {
    keyless: true,
    model: APP_CONFIG.providers.codexModel ?? CODEX_DEFAULT_MODEL
  },
  'gemini': { url: APP_CONFIG.providers.geminiUrl },
  'ollama': {
    keyless: true,
    url: APP_CONFIG.providers.ollamaUrl,
    model: APP_CONFIG.providers.ollamaModel
  },
  'openai': { url: APP_CONFIG.providers.openaiUrl },
  /** No OpenRouter o nome do modelo carrega o fornecedor: `qwen/qwen3-coder`. */
  'openrouter': {
    url: APP_CONFIG.providers.openrouterUrl,
    model: APP_CONFIG.providers.openrouterModel
  }
}

export const PROVIDER_NAMES = Object.keys(PROVIDERS)

/**
 * O provedor que vale antes de alguém abrir a tela; vazio é "sem IA".
 *
 * Instalação nova nasce sem IA: eleger um provedor aqui diria "configurado" sobre um cadastro que
 * não existe, e a primeira chamada morreria por falta de chave. Quem quer a IA pronta desde o
 * primeiro boot nomeia o provedor em `AI_PROVIDER`.
 */
export function providerFromEnvironment(): string {
  return processEnvironment().AI_PROVIDER ?? ''
}

/** Os provedores que não pedem chave: o formulário não marca o campo como obrigatório neles. */
export function keylessProviders(): string[] {
  return Object.entries(PROVIDERS)
    .filter(([, defaults]) => Boolean(defaults.keyless))
    .map(([name]) => name)
}

/** O endereço padrão de cada provedor que tem um. */
export function defaultProviderUrls(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(PROVIDERS)
      .filter(([, defaults]) => Boolean(defaults.url))
      .map(([name, defaults]) => [name, defaults.url!])
  )
}
