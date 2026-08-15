/** Os seletores que o gravador captura para um elemento, do mais estável ao último recurso. */
export interface Selectors {
    dataTestId: string | null
    dataCy: string | null
    ariaLabel: string | null
    ariaRole: string | null
    id: string | null
    name: string | null
    placeholder: string | null
    cssStable: string | null
    xpath: string | null
    text: string | null
    /** O seletor único que o @medv/finder gera quando nada melhor existe. */
    finder: string | null
}

/** O que uma asserção gravada afirma sobre o elemento ou sobre a tela. */
export interface RecordedAssert {
    assertType?: string
    expectedValue?: string | null
}

/**
 * Um evento como o gravador o registra; quase tudo é opcional porque uma gravação antiga pode não
 * ter o campo.
 */
export interface RecordedEvent {
    type: string
    url: string
    timestamp?: number
    selectors?: Selectors | null
    label?: string | null
    value?: string | null
    sensitive?: boolean
    tagName?: string | null
    innerText?: string | null
    inputType?: string | null
    /** O DOM ao redor do elemento. Grande, e por isso só sai da gravação sob demanda. */
    html?: string | null
    /** Estado da caixa quando o campo é checkbox ou radio. */
    checked?: boolean
    /** Presente só nos eventos de asserção. */
    assert?: RecordedAssert
}

export interface Credentials {
    username: string
    password: string
}
