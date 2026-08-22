/**
 * Os eventos de uma gravação. Nenhum valor sensível sai daqui: o que vai para fora é um marcador,
 * ou com o nome da variável que já guarda o valor, ou com um número a ser batizado depois.
 */
import { EnvKey } from '../environment/providers/env-key.js'
import { ActiveVars } from '../../common/playwright/active-vars.js'
import type { Credentials, RecordedEvent } from './events.js'

export const MASK = '••••'

/** Prefixo do marcador de valor sensível que ainda não tem variável. */
export const SENSITIVE_PREFIX = 'SENSIVEL_'

/** Onde o nome do elemento é cortado, para não inchar título de passo nem aviso na tela. */
const NAME_LIMIT = 60

/** O que a gravação sabe do elemento e serve para nomeá-lo. */
interface NamedElement {
  label?: string | null
  innerText?: string | null
  selectors?: { placeholder?: string | null, text?: string | null } | null
}

/** Como um passo chama o elemento que ele toca; null quando nada na gravação o descreve. */
export function describeElement(event: NamedElement): string | null {
  const selectors = event.selectors ?? null
  const source = event.label ?? event.innerText ?? selectors?.placeholder ?? selectors?.text ?? ''
  const clean = source.replace(/\s+/gu, ' ').trim()

  return clean === '' ? null : clean.slice(0, NAME_LIMIT).trimEnd()
}

function marker(key: string): string {
  return `{{${key}}}`
}

export class Recording {
  private constructor(private readonly recorded: RecordedEvent[]) {}

  static make(events: RecordedEvent[]): Recording {
    return new Recording(events)
  }

  /** Os eventos gravados; o DOM capturado só vem quando pedido. */
  events(html = false): RecordedEvent[] {
    if (html) return this.recorded

    return this.recorded.map(({ html: _html, ...event }) => event)
  }

  /** Troca o valor de cada evento sensível pelo marcador. */
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

  /** Os eventos com usuário e senha trocados pelo nome da variável que os guarda. */
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
     * campo de senha, quando não houve submit) que saiu da URL onde o login foi enviado.
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

  /** Usuário e senha reais do login gravado, ou null quando não dá para identificá-los. */
  credentials(): Credentials | null {
    const passwordIndex = this.passwordIndex()

    if (passwordIndex === null) return null

    const userIndex = this.fillBefore(passwordIndex)
    const username = userIndex === null ? null : this.recorded[userIndex]?.value
    const password = this.recorded[passwordIndex]?.value

    return username && password ? { username, password } : null
  }

  /** O valor real de cada marcador batizado, indexado pelo nome que ele recebeu. */
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

  /** O alerta de quando os nomes declarados não cobrem os marcadores da gravação. */
  unmatchedEnvWarning(names: Record<string, string>): string | null {
    const markers = this.sensitiveValues().length
    const declared = Object.keys(names).length

    if (markers === 0 || declared === markers) return null

    return `Gravação tem ${markers} valor(es) sensível(is) mas a IA nomeou ${declared}, `
      + 'e algum .env pode ter ficado vazio.'
  }

  private sensitiveValues(): string[] {
    return this.recorded
      .filter(event => event.sensitive === true)
      .map(event => event.value ?? '')
  }

  private passwordIndex(): number | null {
    const index = this.recorded.findIndex(
      event => event.type === 'fill' && event.inputType === 'password'
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
