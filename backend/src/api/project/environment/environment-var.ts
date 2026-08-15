/** Uma variável do ambiente do projeto. Portado de `App\Data\V1\Project\EnvironmentVarData`. */
export interface EnvironmentVar {
    key: string
    value: string | null
    secret: boolean
    pending: boolean
}

/** O que vale como nome de variável. Mesmo padrão que o `.env` aceita. */
export const ENV_KEY = '[A-Za-z_][A-Za-z0-9_]*'

export function environmentVar(
    key: string,
    value: string | null = null,
    secret = false,
    pending = false
): EnvironmentVar {
    return { key, value, secret, pending }
}

/** Lê uma linha de `.env`, ou null quando a linha não é uma atribuição. */
export function fromLine(line: string): EnvironmentVar | null {
    const match = line.trim().match(new RegExp(`^(${ENV_KEY})=(.*)$`))

    if (!match) return null

    return environmentVar(match[1]!, match[2]!.trim().replace(/^["']|["']$/g, ''))
}

export function keyed(vars: EnvironmentVar[], key: string): EnvironmentVar | null {
    return vars.find((variable) => variable.key === key) ?? null
}
