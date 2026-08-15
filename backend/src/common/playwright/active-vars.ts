/** As variáveis do ambiente ativo: quais existem, quais têm valor e quais podem sair em claro. */
import { ENV_KEY, keyed, type EnvironmentVar } from '../../modules/environment/providers/environment-var.js'

export class ActiveVars {
    constructor(public readonly vars: EnvironmentVar[] = []) {
        const keys = vars.map((variable) => variable.key)

        for (const key of keys) {
            if (!new RegExp(`^${ENV_KEY}$`).test(key)) {
                throw new Error(`Nome de variável inválido: ${key}`)
            }
        }

        if (new Set(keys).size !== keys.length) {
            throw new Error('O ambiente declara a mesma variável duas vezes.')
        }
    }

    get(key: string): EnvironmentVar | null {
        return keyed(this.vars, key)
    }

    has(key: string): boolean {
        return this.get(key) !== null
    }

    /** A chave que já guarda esse valor, se alguma guardar. */
    keyOf(value: string): string | null {
        if (!value) return null

        return this.vars.find((variable) => variable.value === value)?.key ?? null
    }

    /** Se a chave está declarada mas sem valor. */
    isEmpty(key: string): boolean {
        return !this.get(key)?.value
    }

    /** As que têm valor não secreto, e portanto podem vazar literais para o arquivo gerado. */
    exposed(): EnvironmentVar[] {
        return this.vars.filter((variable) => !variable.secret && Boolean(variable.value))
    }
}
