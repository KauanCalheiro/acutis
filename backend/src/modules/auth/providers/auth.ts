/**
 * A autenticação do projeto: o arquivo de login e o `playwright.config.ts` que o faz rodar antes
 * dos cenários.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ensureGitignore } from '../../project/providers/gitignore.js'
import { templateFile } from '../../project/providers/template.js'

export const AUTH_ID = 'auth'
export const AUTH_SPEC = 'tests/auth.setup.ts'
export const AUTH_FEATURE = 'features/auth.feature'

export function authExists(projectPath: string): boolean {
    return existsSync(join(projectPath, AUTH_SPEC))
}

/** O bloco de projetos que faz o `setup` rodar antes, e os cenários herdarem a sessão dele. */
const PROJECTS_BLOCK = `
    projects: [
        { name: 'setup', testMatch: /auth\\.setup\\.ts/ },
        { name: 'publicos', testMatch: /.*\\.spec\\.ts/, grep: /@publico/ },
        {
            name: 'autenticados',
            testMatch: /.*\\.spec\\.ts/,
            grepInvert: /@publico/,
            dependencies: ['setup'],
            use: { storageState: process.env.STORAGE_STATE || 'storage-state.json' },
        },
    ],
`

function withProjects(config: string): string {
    if (config.includes('projects:') || !config.includes('defineConfig({')) return config

    return config.replace('defineConfig({', `defineConfig({${PROJECTS_BLOCK}`)
}

export function ensureAuthConfig(projectPath: string): void {
    mkdirSync(join(projectPath, 'tests'), { recursive: true })

    const file = join(projectPath, 'playwright.config.ts')

    if (!existsSync(file)) {
        copyFileSync(templateFile('playwright.config.ts'), file)
    } else {
        writeFileSync(file, withProjects(readFileSync(file, 'utf8')))
    }

    ensureGitignore(projectPath)
}
