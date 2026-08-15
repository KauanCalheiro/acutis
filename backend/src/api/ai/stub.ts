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
export const GHERKIN: GeneratedScenario = {
    gherkin: 'Funcionalidade: Login do Usuário\n  Cenário: entra',
    domain: 'login'
}

export function writeGherkin(prompt?: GherkinPrompt): GeneratedScenario {
    aiLog.gherkin = prompt ?? null

    return GHERKIN
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

/**
 * O setup de login corrigido — o que o `AuthFixer` devolvia, separado do `fixedSpec()` do cenário
 * porque eram dois agentes com contratos diferentes.
 *
 * Diferente do cenário, aqui o vazio não serve: a resposta volta para o laço de correção, que a
 * confere contra as mesmas regras que o corretor de verdade tinha de satisfazer. Um arquivo vazio
 * quebraria todas elas e faria o laço girar até o teto contra a própria resposta.
 */
export const AUTH_FIX: FixedSpec = {
    playwright: [
        "import { test as setup, expect } from '@playwright/test'",
        '',
        'const base = process.env.URL',
        '',
        "setup('autenticação', async ({ page }) => {",
        '    await page.goto(base)',
        "    await page.getByTestId('pass').fill(process.env.AUTH_PASSWORD)",
        "    await expect(page.getByTestId('pass')).toBeHidden()",
        "    await page.context().storageState({ path: process.env.STORAGE_STATE || 'storage-state.json' })",
        '})',
        ''
    ].join('\n'),
    summary: AI_DISABLED_SUMMARY
}

export function fixedAuthSetup(prompt: AuthFixPrompt): FixedSpec {
    aiLog.authFix = prompt
    aiLog.authFixCalls++

    return AUTH_FIX
}

/** O que o `GherkinWriter` recebia: a URL base e os eventos já sem senha. */
export interface GherkinPrompt {
    baseUrl: string
    events: unknown[]
}

/** O que o `AuthFixer` recebia: o arquivo, o que quebrou nele e como a execução falhou. */
export interface AuthFixPrompt {
    spec: string
    violations: { rule: string, message: string }[]
    error?: string
    html?: string
    events: unknown[]
}

/**
 * O que cada agente recebeu por último, e quantas vezes o corretor foi chamado.
 *
 * É o que substitui o `Agent::assertPrompted()` do Pest: sem isto não há como afirmar que a senha
 * real nunca chega ao modelo, que é o que os testes de autenticação precisam garantir. Guarda só a
 * última chamada, para não crescer sem limite em produção, e sai junto com o stub.
 */
export interface AiLog {
    gherkin: GherkinPrompt | null
    authFix: AuthFixPrompt | null
    authFixCalls: number
}

export const aiLog: AiLog = { gherkin: null, authFix: null, authFixCalls: 0 }

export function resetAiLog(): void {
    aiLog.gherkin = null
    aiLog.authFix = null
    aiLog.authFixCalls = 0
}
