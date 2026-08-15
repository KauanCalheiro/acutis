/** O que cada agente devolve enquanto a IA está desligada, no mesmo formato da geração de verdade. */

/** O Gherkin do cenário e o domínio a que ele pertence. */
export interface GeneratedScenario {
    gherkin: string
    domain: string
}

/** O trecho corrigido e o resumo do que mudou. */
export interface FixedSpec {
    playwright: string
    summary: string
}

/** Uma sugestão de `data-testid`, por evento sem seletor estável. */
export interface SelectorSuggestion {
    event: string
    currentSelector: string
    suggestedTestId: string
    reason: string
}

export const AI_DISABLED_SUMMARY = 'A geração por IA está desativada nesta versão do acutis.'

/**
 * Se há provedor configurado.
 *
 * ponytail: enquanto o provedor é este módulo, a variável só existe para o teste conseguir
 * desligá-lo; o cadastro de verdade mora no `SettingsService`.
 */
export function aiConfigured(): boolean {
    return (process.env.ACUTIS_AI_PROVIDER ?? 'stub') !== ''
}

/** O cenário em Gherkin devolvido enquanto não há modelo. */
export const GHERKIN: GeneratedScenario = {
    gherkin: 'Funcionalidade: Login do Usuário\n  Cenário: entra',
    domain: 'login'
}

export function writeGherkin(prompt?: GherkinPrompt): GeneratedScenario {
    aiLog.gherkin = prompt ?? null

    return GHERKIN
}

/** Correção vazia: não há nada a aplicar sem modelo. */
export function fixedSpec(): FixedSpec {
    return { playwright: '', summary: AI_DISABLED_SUMMARY }
}

/** Sem modelo não há sugestão a fazer. */
export function fixedSuggestions(): SelectorSuggestion[] {
    return []
}

/** O setup de login corrigido, no formato que o laço de correção confere contra as regras. */
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

/** O que o escritor de Gherkin recebe: a URL base e os eventos já sem senha. */
export interface GherkinPrompt {
    baseUrl: string
    events: unknown[]
}

/** O que o corretor do login recebe: o arquivo, o que quebrou nele e como a execução falhou. */
export interface AuthFixPrompt {
    spec: string
    violations: { rule: string, message: string }[]
    error?: string
    html?: string
    events: unknown[]
}

/** O que cada agente recebeu por último, e quantas vezes o corretor foi chamado. */
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
