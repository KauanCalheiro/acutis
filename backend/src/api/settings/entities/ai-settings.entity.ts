/**
 * O que a tela de configurações de IA lê e escreve.
 *
 * Os nomes em snake_case são os que o Laravel respondia, e o frontend os lê assim — trocar para
 * camelCase aqui obrigaria a mexer em tela, que é justamente o que a migração evita.
 */

/** O cadastro de um provedor. A chave volta em claro de propósito: veja `SettingsService`. */
export interface ProviderCredential {
    key: string | null
    url: string | null
    model: string | null
}

export interface AiSettings {
    /** O provedor ativo. Vazio é "sem IA", e é um estado legítimo, não um erro. */
    provider: string
    /** Falso desabilita, no frontend, todo botão que chamaria um agente. */
    configured: boolean
    credentials: Record<string, ProviderCredential>
    providers: string[]
    provider_urls: Record<string, string>
}

/** O provedor ativo já resolvido: cadastro por cima dos padrões, que é o que um agente usaria. */
export interface ResolvedProvider {
    provider: string
    key: string | null
    url: string | null
    model: string | null
}
