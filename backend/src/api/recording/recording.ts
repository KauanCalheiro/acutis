/**
 * Os eventos de uma gravação.
 *
 * Duas marcações convivem aqui de propósito: a do fluxo de cenário, que confia na flag `sensitive`
 * posta pelo gravador, e a do login, que reconhece o campo pelo inputType, porque a gravação de
 * auth não marca a senha como sensível.
 *
 * Nenhum valor sensível sai daqui: o que vai para fora é um marcador. Quando o valor já existe no
 * ambiente, o marcador é o nome da variável; quando não, é um número atribuído aqui e devolvido
 * batizado. Assim o pareamento entre valor e variável nunca depende de posição.
 */
import { EnvKey } from '../project/environment/env-key.js'
import { ActiveVars } from '../playwright/active-vars.js'
import type { Credentials, RecordedEvent } from './events.js'

export const MASK = '••••'

/** Prefixo do marcador de valor sensível que ainda não tem variável. */
export const SENSITIVE_PREFIX = 'SENSIVEL_'

function marker(key: string): string {
    return `{{${key}}}`
}

export class Recording {
    private constructor(private readonly recorded: RecordedEvent[]) {}

    static make(events: RecordedEvent[]): Recording {
        return new Recording(events)
    }

    /**
     * Os eventos gravados. O DOM capturado fica de fora por padrão: é grande e só serve sob
     * demanda. Quem precisa dele pede.
     */
    events(html = false): RecordedEvent[] {
        if (html) return this.recorded

        // A chave sai de verdade, não vira null: é o que impede o DOM de viajar em payload e de ser
        // gravado no arquivo de eventos.
        return this.recorded.map(({ html: _html, ...event }) => event)
    }

    /**
     * Troca o valor de cada evento sensível pelo marcador. Usar antes de mandar eventos gravados
     * para fora ou gravá-los em disco.
     */
    redacted(environments: ActiveVars = new ActiveVars()): RecordedEvent[] {
        let position = 0

        return this.events().map((event) => {
            if (event.sensitive !== true) return event

            position++
            const value = event.value ?? ''

            return {
                ...event,
                value: marker(environments.keyOf(value) ?? `${SENSITIVE_PREFIX}${position}`)
            }
        })
    }

    /** O DOM ao redor de cada elemento, na chave do evento que o produziu. */
    html(): Record<number, string> {
        const html: Record<number, string> = {}

        this.recorded.forEach((event, index) => {
            if (event.html) html[index] = event.html
        })

        return html
    }

    /**
     * A senha real chega ao backend (é ela que vai para o .env do projeto), mas não sai daqui.
     * Usuário e senha viram o nome da variável que os guarda, então quem lê não precisa deduzir
     * qual campo é qual.
     */
    withoutPasswords(): RecordedEvent[] {
        const events = this.events()
        const password = this.passwordIndex()

        for (const [index, event] of events.entries()) {
            if (event.inputType === 'password') {
                events[index] = { ...event, value: marker(EnvKey.PASSWORD) }
            }
        }

        const user = password === null ? null : this.fillBefore(password)

        if (user !== null) {
            events[user] = { ...events[user]!, value: marker(EnvKey.USER) }
        }

        return events
    }

    /**
     * A URL em que a gravação caiu depois do login: a primeira navegação após o submit (ou após o
     * campo de senha, quando não houve submit) que saiu da URL onde o login foi enviado. É a única
     * URL que pode virar asserção no teste — qualquer outra seria inventada.
     */
    landingUrl(): string | null {
        let submitIndex: number | null = null

        this.recorded.forEach((event, index) => {
            if (event.type === 'submit' || (event.type === 'fill' && event.inputType === 'password')) {
                submitIndex = index
            }
        })

        if (submitIndex === null) return null

        const submitUrl = this.recorded[submitIndex]!.url

        for (const event of this.recorded.slice(submitIndex + 1)) {
            if (event.type === 'navigate' && event.url && event.url !== submitUrl) {
                return event.url
            }
        }

        return null
    }

    /**
     * Usuário e senha reais do login gravado, ou null quando não dá para identificá-los. Sem um dos
     * dois não há login executável, então quem chamou precisa pedir ao usuário.
     */
    credentials(): Credentials | null {
        const passwordIndex = this.passwordIndex()

        if (passwordIndex === null) return null

        const userIndex = this.fillBefore(passwordIndex)
        const username = userIndex === null ? null : this.recorded[userIndex]?.value
        const password = this.recorded[passwordIndex]?.value

        return username && password ? { username, password } : null
    }

    /**
     * O valor real de cada marcador batizado. O pareamento é pela chave do marcador, atribuída
     * aqui, e não pela ordem da resposta.
     */
    envValues(names: Record<string, string>): Record<string, string> {
        const sensitive = this.sensitiveValues()
        const values: Record<string, string> = {}

        for (const [key, name] of Object.entries(names)) {
            if (!key.startsWith(SENSITIVE_PREFIX)) continue

            const position = Number(key.slice(SENSITIVE_PREFIX.length))
            const value = sensitive[position - 1]

            if (value === undefined) continue

            values[name] = value
        }

        return values
    }

    /**
     * Alerta quando os nomes declarados não cobrem os marcadores da gravação: sobrando ou faltando,
     * algum valor sensível fica sem variável e o teste recebe undefined em runtime.
     */
    unmatchedEnvWarning(names: Record<string, string>): string | null {
        const markers = this.sensitiveValues().length
        const declared = Object.keys(names).length

        if (markers === 0 || declared === markers) return null

        return `Gravação tem ${markers} valor(es) sensível(is) mas a IA nomeou ${declared}, `
            + 'e algum .env pode ter ficado vazio.'
    }

    private sensitiveValues(): string[] {
        return this.recorded
            .filter((event) => event.sensitive === true)
            .map((event) => event.value ?? '')
    }

    private passwordIndex(): number | null {
        const index = this.recorded.findIndex(
            (event) => event.type === 'fill' && event.inputType === 'password'
        )

        return index === -1 ? null : index
    }

    /** O preenchimento anterior ao índice dado, que é onde o usuário do login foi digitado. */
    private fillBefore(index: number): number | null {
        for (let i = index - 1; i >= 0; i--) {
            if (this.recorded[i]?.type === 'fill') return i
        }

        return null
    }
}
