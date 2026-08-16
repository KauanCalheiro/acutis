/** O que cada caso de uso responde enquanto não há provedor de IA cadastrado. */
import type { FixedSpec } from '../agents/spec-fixer.js'

export type { FixedSpec }

/** Uma sugestão de `data-testid`, por evento sem seletor estável. */
export interface SelectorSuggestion {
    event: string
    currentSelector: string
    suggestedTestId: string
    reason: string
}

export const AI_DISABLED_SUMMARY = 'A geração por IA está desativada nesta versão do acutis.'

/** Correção vazia: não há nada a aplicar sem modelo. */
export function fixedSpec(): FixedSpec {
    return { playwright: '', summary: AI_DISABLED_SUMMARY }
}

/** Sem modelo não há sugestão a fazer. */
export function fixedSuggestions(): SelectorSuggestion[] {
    return []
}
