export type RecordingEventType =
    | 'click' | 'fill' | 'navigate' | 'submit' | 'assert' | 'hover'

export type AssertType =
    | 'exists' | 'hidden' | 'visible' | 'text' | 'value' | 'contains' | 'checked' | 'disabled' | 'url'

export interface AssertPayload {
    assertType: AssertType
    expectedValue: string | null
}

export interface RecordingSelectors {
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
    finder: string | null
}

export interface RecordingEvent {
    type: RecordingEventType
    timestamp: number
    url: string
    selectors: RecordingSelectors | null
    label: string | null
    value: string | null
    sensitive: boolean
    tagName: string | null
    innerText: string | null
    inputType: string | null
    /** Estado do campo que alterna; null quando o elemento não tem esse estado. */
    checked: boolean | null
    /** O DOM ao redor do elemento no instante da ação. Sai dos eventos ao persistir, para não inchá-los. */
    html: string | null
    assert?: AssertPayload
}
