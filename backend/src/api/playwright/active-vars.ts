/**
 * As variáveis do ambiente ativo.
 *
 * Chega às regras e aos payloads como tipo, e não como lista solta, porque é ela que decide se uma
 * chave existe, se tem valor e se o valor pode sair daqui — três perguntas que antes cada chamador
 * respondia do seu jeito.
 */
import { ENV_KEY, keyed, type EnvironmentVar } from '../project/environment/environment-var.js'

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

    /**
     * A chave que já guarda esse valor, se alguma guardar. É por aqui que um valor gravado vira
     * marcador sem o modelo precisar reconhecê-lo, inclusive quando é segredo.
     */
    keyOf(value: string): string | null {
        if (!value) return null

        return this.vars.find((variable) => variable.value === value)?.key ?? null
    }

    /** Declarada mas sem valor: em runtime chega undefined no teste e ele quebra. */
    isEmpty(key: string): boolean {
        return !this.get(key)?.value
    }

    /**
     * As que carregam um valor que pode vazar literal para o arquivo gerado. A secreta fica de fora
     * porque o valor dela nunca chega ao modelo, então não há literal a acusar.
     */
    exposed(): EnvironmentVar[] {
        return this.vars.filter((variable) => !variable.secret && Boolean(variable.value))
    }
}
