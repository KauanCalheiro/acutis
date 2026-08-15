/**
 * O `.gitignore` do projeto: o que nunca deve ser versionado.
 *
 * Escrito por acréscimo, nunca por substituição — o usuário pode ter posto coisas dele ali, e
 * reescrever o arquivo apagaria.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENTRIES = [
    'node_modules',
    'storage-state.json',
    'storage-state.*.json',
    '.env',
    'environments',
    'results',
    'playwright-report',
    'test-results',
    '*.dom.json'
]

function file(projectPath: string): string {
    return join(projectPath, '.gitignore')
}

export function gitignoreExists(projectPath: string): boolean {
    return existsSync(file(projectPath))
}

export function ensureGitignore(projectPath: string): void {
    const target = file(projectPath)
    const existing = existsSync(target) ? readFileSync(target, 'utf8') : ''
    const missing = ENTRIES.filter((entry) => !existing.includes(entry))

    if (missing.length === 0) return

    writeFileSync(target, `${`${existing}\n${missing.join('\n')}`.replace(/\n+$/, '')}\n`)
}
