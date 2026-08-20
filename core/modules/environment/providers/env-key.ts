/**
 * Chaves que o acutis escreve e lê. As que a IA declara para um cenário são dinâmicas e não cabem
 * aqui.
 */
export const EnvKey = {
  /** URL do sistema sob teste: onde o navegador abre ao gravar e a base que o Playwright usa. */
  URL: 'URL',

  /** Credenciais do login, sob o prefixo `AUTH_` para não colidir com variáveis do shell. */
  USER: 'AUTH_USER',
  PASSWORD: 'AUTH_PASSWORD',

  ACTIVE_ENVIRONMENT: 'ENVIRONMENT',

  /** Arquivo de sessão do ambiente ativo: o auth.setup.ts grava nele e os cenários o carregam. */
  STORAGE_STATE: 'STORAGE_STATE'
} as const

export type EnvKeyValue = (typeof EnvKey)[keyof typeof EnvKey]

/** Se a chave pertence ao acutis, que a escreve no `.env` do projeto. */
export function ownsKey(key: string): boolean {
  return Object.values(EnvKey).includes(key as EnvKeyValue)
}
