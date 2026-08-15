/**
 * O ponto de reentrada da IA, e o único lugar do backend Node que sabe que ela está desligada.
 *
 * A migração deixou os agentes fora do escopo: os endpoints que chamavam modelo continuam
 * existindo e respondendo o mesmo formato, mas o que devolvem vem daqui em vez de uma geração. O
 * contrato com o frontend não muda — a tela não sabe a diferença.
 *
 * Quando a IA voltar, é este arquivo que troca o objeto fixo por uma chamada ao AI SDK, sem tocar
 * em service nem em controller.
 */

/** O que o `ScenarioFixer` devolvia: o trecho corrigido e o resumo do que mudou. */
export interface FixedSpec {
    playwright: string
    summary: string
}

/** O que o `SelectorWriter` devolvia, um item por evento sem seletor estável. */
export interface SelectorSuggestion {
    event: string
    currentSelector: string
    suggestedTestId: string
    reason: string
}

export const AI_DISABLED_SUMMARY = 'A geração por IA está desativada nesta versão do acutis.'

/**
 * Playwright vazio é o que diz à tela que não há nada a aplicar. Sem provedor configurado o botão
 * que chega aqui já nasce desabilitado, então este é o caminho que ninguém percorre por engano.
 */
export function fixedSpec(): FixedSpec {
    return { playwright: '', summary: AI_DISABLED_SUMMARY }
}

/** Sem modelo não há sugestão a fazer, e lista vazia é exatamente o que a tela já sabe desenhar. */
export function fixedSuggestions(): SelectorSuggestion[] {
    return []
}
