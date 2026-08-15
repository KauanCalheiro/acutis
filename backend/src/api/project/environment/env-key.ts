/**
 * Chaves que o acutis escreve e lê. As que a IA declara para um cenário são dinâmicas e não cabem
 * aqui.
 */
export const EnvKey = {
    /** URL do sistema sob teste: onde o navegador abre ao gravar e a base que o Playwright usa. */
    URL: 'URL',

    /**
     * Prefixo AUTH_ de propósito: USER e PASSWORD puros colidem com variáveis do shell (no Unix o
     * USER do sistema já vem no ambiente do processo), e o teste receberia o usuário da máquina em
     * vez de falhar por credencial faltando.
     */
    USER: 'AUTH_USER',
    PASSWORD: 'AUTH_PASSWORD',

    ACTIVE_ENVIRONMENT: 'ENVIRONMENT',

    /** Arquivo de sessão do ambiente ativo: o auth.setup.ts grava nele e os cenários o carregam. */
    STORAGE_STATE: 'STORAGE_STATE'
} as const

export type EnvKeyValue = (typeof EnvKey)[keyof typeof EnvKey]

/**
 * A chave pertence ao acutis, que a escreve no .env do projeto. Vale mesmo sem estar declarada no
 * ambiente, porque quem a preenche na hora de rodar não é o usuário.
 */
export function ownsKey(key: string): boolean {
    return Object.values(EnvKey).includes(key as EnvKeyValue)
}
