/**
 * O que os testes da API precisam montar antes de exercitar qualquer coisa.
 *
 * Equivale ao `tests/Pest.php` do Laravel, e existe pelo mesmo motivo: um evento gravado tem doze
 * campos e um seletor tem onze, e repetir isso em cada teste esconde o que cada um está de fato
 * verificando.
 */
import { ActiveVars } from '../../src/common/playwright/active-vars.js'
import type { EnvironmentVar } from '../../src/modules/environment/providers/environment-var.js'
import { Url } from '../../src/common/playwright/url.js'
import type { RecordedEvent, Selectors } from '../../src/modules/recording/events.js'

/** A URL base das fixtures, com caminho — para pegar o caso do segmento repetido. */
export const SPEC_BASE_URL = 'https://sistema.test/intranet'

/** Um evento gravado com todos os campos preenchidos, para o teste sobrescrever só o que importa. */
export function emitEvent(type: string, overrides: Partial<RecordedEvent> = {}): RecordedEvent {
    return {
        type,
        timestamp: 1000,
        url: `${SPEC_BASE_URL}/produtos`,
        selectors: null,
        label: null,
        value: null,
        sensitive: false,
        tagName: null,
        innerText: null,
        inputType: null,
        html: null,
        ...overrides
    } as RecordedEvent
}

/** O conjunto de seletores que o gravador captura, todos nulos até o teste dizer o contrário. */
export function selectors(overrides: Partial<Selectors> = {}): Selectors {
    return {
        dataTestId: null,
        dataCy: null,
        ariaLabel: null,
        ariaRole: null,
        id: null,
        name: null,
        placeholder: null,
        cssStable: null,
        xpath: null,
        text: null,
        finder: null,
        ...overrides
    }
}

/**
 * O ambiente ativo das fixtures: uma variável comum com valor e uma secreta.
 *
 * A secreta é o que faz o emitter trocar o valor digitado por `process.env`, e sem ela metade das
 * asserções sobre redação não teria como acontecer.
 */
export function specEnvironment(extra: EnvironmentVar[] = []): EnvironmentVar[] {
    return [
        { key: 'URL', value: SPEC_BASE_URL, secret: false, pending: false },
        { key: 'AUTH_USER', value: 'usuario-de-teste', secret: false, pending: false },
        { key: 'AUTH_PASSWORD', value: 'topsecret123', secret: true, pending: false },
        ...extra
    ]
}

export function specUrl(): Url {
    return new Url(SPEC_BASE_URL)
}

/** O mesmo ambiente, no tipo que percorre regras e payloads. */
export function specActiveVars(extra: EnvironmentVar[] = []): ActiveVars {
    return new ActiveVars(specEnvironment(extra))
}
