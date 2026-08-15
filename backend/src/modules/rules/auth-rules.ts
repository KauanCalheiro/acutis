/**
 * As regras que só valem para o arquivo de login, somadas às que valem para qualquer arquivo
 * Playwright.
 */
import type { ActiveVars } from '../../common/playwright/active-vars.js'
import type { Playwright } from '../../common/playwright/playwright.js'
import type { Url } from '../../common/playwright/url.js'
import { checkSpec, type Rule } from './spec-rules.js'
import { violation, type Violation } from './violation.js'

const storageState: Rule = (file) => {
    if (file.has('storageState(')) return []

    return [violation(
        'storage-state-ausente',
        'O setup termina sem salvar a sessão; feche com page.context().storageState({ path: ... }).'
    )]
}

const setupImport: Rule = (file) => {
    if (file.matches(/import\s*\{[^}]*\btest\s+as\s+setup\b/)) return []

    return [violation(
        'setup-import',
        "O arquivo de login importa o helper errado; use import { test as setup } from '@playwright/test'."
    )]
}

/** Sessão salva sem login deixa todo cenário autenticado rodando deslogado. */
const earlyReturn: Rule = (file) => {
    if (!file.matches(/\breturn\b/)) return []

    return [violation(
        'login-contornado',
        'O setup tem saída antecipada; ele precisa executar o login inteiro sempre, porque sessão '
            + 'salva sem login deixa todo cenário autenticado rodando deslogado.'
    )]
}

const RULES: Rule[] = [storageState, setupImport, earlyReturn]

export function checkAuth(file: Playwright, base: Url, environments: ActiveVars): Violation[] {
    return [
        ...checkSpec(file, base, environments),
        ...RULES.flatMap((rule) => rule(file, base, environments))
    ]
}
