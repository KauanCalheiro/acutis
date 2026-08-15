/**
 * As regras do `data-testid` que o acutis sugere para elementos sem seletor estável.
 *
 * Não dependem de modelo: são a convenção do projeto escrita como código, e valem igual para quem
 * sugere e para quem revisa.
 */
import { violation, type Violation } from './violation.js'

export interface SelectorSuggestion {
    suggestedTestId: string
    [key: string]: unknown
}

/** Minúsculas separadas por hífen, sem acento e sem underscore. */
export const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/

function kebab(suggestions: SelectorSuggestion[]): Violation[] {
    return suggestions
        .filter((suggestion) => !KEBAB.test(suggestion.suggestedTestId))
        .map((suggestion) => violation(
            'testid-kebab',
            `O data-testid ${suggestion.suggestedTestId} não está em kebab-case minúsculo.`
        ))
}

/** Um testid de palavra única não diz o que o elemento faz, só onde ele está. */
function resourceAction(suggestions: SelectorSuggestion[]): Violation[] {
    return suggestions
        .filter(({ suggestedTestId: id }) => KEBAB.test(id) && !id.includes('-'))
        .map(({ suggestedTestId: id }) => violation(
            'testid-recurso-acao',
            `O data-testid ${id} não nomeia recurso e ação; use <recurso>-<acao>.`
        ))
}

export function checkSelectors(suggestions: SelectorSuggestion[]): Violation[] {
    return [...kebab(suggestions), ...resourceAction(suggestions)]
}
