import { cpSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const FIXTURES_DIR = resolve(import.meta.dirname, '../fixtures/projects')

/**
 * Cópia temporária dos projetos de fixture. Todo projeto precisa de URL: sem ela a página abre o
 * modal de configurações travado. O .env é escrito aqui e não vem do fixture porque o repositório
 * ignora .env em qualquer nível — e escrever no fixture sujaria a pasta versionada.
 */
export function projectsCopy(url?: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'acutis-projects-'))
    cpSync(FIXTURES_DIR, dir, { recursive: true })

    for (const project of readdirSync(dir)) {
        projectEnv(dir, project, url)
    }

    return dir
}

/** Devolve um projeto ao estado do fixture, para o teste seguinte não herdar o que este mudou. */
export function projectReset(dir: string, project: string, url?: string): void {
    rmSync(join(dir, project), { recursive: true, force: true })
    cpSync(join(FIXTURES_DIR, project), join(dir, project), { recursive: true })
    projectEnv(dir, project, url)
}

function projectEnv(dir: string, project: string, url?: string): void {
    writeFileSync(join(dir, project, '.env'), `URL=${url ?? `https://${project}.test`}\n`)
}
