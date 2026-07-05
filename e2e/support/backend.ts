import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const BACKEND_DIR = resolve(import.meta.dirname, '../../backend')
export const BACKEND_URL = 'http://localhost:4200'

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
    throw new Error(`port 4200 still in use; stale backend running on ${BACKEND_URL}?`)
}

async function waitHealthy(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        if (await portInUse()) return
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('backend did not become healthy in time')
}

/** Sobe o php artisan serve na 4200 e devolve o stop que espera a porta liberar. */
export async function startBackend(env: Record<string, string>): Promise<() => Promise<void>> {
    await waitPortFree()

    const proc = spawn('php', ['artisan', 'serve', '--port=4200'], {
        cwd: BACKEND_DIR,
        stdio: 'ignore',
        env: { ...process.env, ...env },
    })

    await waitHealthy()

    return async () => {
        const exited = new Promise((r) => proc.once('exit', r))
        proc.kill()
        await exited
        await waitPortFree()
    }
}
