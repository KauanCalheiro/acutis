/** O que a tela de configurações de IA lê e escreve. */
export type { ProviderCredential, AiSettings } from '#shared/contracts/settings'

/** O provedor ativo já resolvido: cadastro por cima dos padrões, que é o que um agente usaria. */
export interface ResolvedProvider {
  provider: string
  key: string | null
  url: string | null
  model: string | null
}
