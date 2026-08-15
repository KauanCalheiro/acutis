/**
 * O ponto de reentrada da IA, e o único lugar do backend Node que sabe que ela está desligada.
 *
 * A migração deixou os agentes fora do escopo: os endpoints que chamavam modelo continuam
 * existindo e respondendo o mesmo formato, mas o que devolvem vem daqui em vez de uma geração. O
 * contrato com o frontend não muda — a tela não sabe a diferença.
 *
 * Quando a IA voltar, é este arquivo que troca os objetos fixos por chamadas ao AI SDK, sem tocar
 * em service nem em controller. Cada função abaixo corresponde a um agente que existia no Laravel.
 */

/** O que o `GherkinWriter` devolvia: o Gherkin do cenário e o domínio a que ele pertence. */
export interface GeneratedScenario {
    gherkin: string
    domain: string
}

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
 * O provedor configurado. Espelha o `Provider::configured()` do Laravel, que lia `config('ai.default')`:
 * sem provedor o acutis continua funcionando, só que o cenário sai só da gravação.
 *
 * ponytail: enquanto o provedor é este módulo, a variável só existe para o teste conseguir
 * desligá-lo; quando a IA voltar, ela passa a ler o cadastro de verdade (`SettingsService`).
 */
export function aiConfigured(): boolean {
    return (process.env.ACUTIS_AI_PROVIDER ?? 'stub') !== ''
}

/**
 * O cenário em Gherkin. Fixo: descrever a gravação é justamente o que exige modelo, e inventar uma
 * heurística aqui seria criar um segundo comportamento para desfazer quando a IA voltar.
 */
export function writeGherkin(): GeneratedScenario {
    return {
        gherkin: 'Funcionalidade: Login do Usuário\n  Cenário: entra',
        domain: 'login'
    }
}

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
