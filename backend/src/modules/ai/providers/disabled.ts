/** O que cada caso de uso responde enquanto não há provedor de IA cadastrado. */
import type { FixedSpec } from '../agents/spec-fixer.js'
import type { SelectorSuggestion } from '@acutis/contracts/scenario'

export type { FixedSpec, SelectorSuggestion }

export const AI_DISABLED_SUMMARY = 'A geração por IA está desativada nesta versão do acutis.'

/** Correção vazia: não há nada a aplicar sem modelo. */
export function fixedSpec(): FixedSpec {
    return { playwright: '', summary: AI_DISABLED_SUMMARY }
}

/** Sem modelo não há sugestão a fazer. */
export function fixedSuggestions(): SelectorSuggestion[] {
    return []
}
