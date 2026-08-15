import { spawn } from 'node:child_process'
import { copyFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { BACKEND_URL, PORTS, WEBDRIVER_URL } from './ports'

// O Laravel, que sai quando a migração para Node terminar.
const BACKEND_DIR = resolve(import.meta.dirname, '../../backend-laravel')

/** O banco que o `pretest` migra. Não é o de desenvolvimento. */
const E2E_DATABASE = resolve(BACKEND_DIR, 'database/e2e.sqlite')

export { BACKEND_URL }

/**
 * Cópia temporária do banco do E2E, já migrada. Quem grava configuração usa isto: sem a cópia, o
 * que um teste salva sobrevive à execução e o teste seguinte herda, inclusive em rodada escopada.
 */
export function databaseCopy(): string {
    const file = join(mkdtempSync(join(tmpdir(), 'acutis-db-')), 'e2e.sqlite')

    copyFileSync(E2E_DATABASE, file)

    return file
}

async function portInUse(): Promise<boolean> {
    try {
        await fetch(`${BACKEND_URL}/api/v1/projects`)
        return true
    } catch {
        return false
    }
}

async function waitPortFree(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        if (!await portInUse()) return
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error(`port ${PORTS.backend} still in use; stale backend running on ${BACKEND_URL}?`)
}

async function waitHealthy(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        if (await portInUse()) return
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('backend did not become healthy in time')
}

/** Sobe o php artisan serve na porta do E2E e devolve o stop que espera a porta liberar. */
export async function startBackend(env: Record<string, string>): Promise<() => Promise<void>> {
    await waitPortFree()

    const proc = spawn('php', ['artisan', 'serve', `--port=${PORTS.backend}`], {
        cwd: BACKEND_DIR,
        stdio: 'ignore',
        // O banco é o que o setup.sh migra, e não o de desenvolvimento: sem isto um teste que
        // grave configuração escreveria no ambiente de quem está rodando a suíte.
        // O banco é o que o setup.sh migra, e não o de desenvolvimento: sem isto um teste que
        // grave configuração escreveria no ambiente de quem está rodando a suíte. Quem escreve no
        // banco passa DB_DATABASE apontando para uma cópia, via databaseCopy().
        env: { ...process.env, WEBDRIVER_URL, DB_DATABASE: E2E_DATABASE, ...env },
    })

    await waitHealthy()

    return async () => {
        const exited = new Promise((r) => proc.once('exit', r))
        proc.kill()
        await exited
        await waitPortFree()
    }
}
