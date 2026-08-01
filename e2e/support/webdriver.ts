import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
import { FRONTEND_URL, PORTS, WEBDRIVER_URL } from './ports'

const WEBDRIVER_DIR = resolve(import.meta.dirname, '../../webdriver')

export { WEBDRIVER_URL }

async function portInUse(): Promise<boolean> {
    try {
        await fetch(`${WEBDRIVER_URL}/health`)
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
    throw new Error(`port ${PORTS.webdriver} still in use; stale webdriver running on ${WEBDRIVER_URL}?`)
}

async function waitHealthy(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        if (await portInUse()) return
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('webdriver did not become healthy in time')
}

/** Sobe o webdriver em modo teste na porta do E2E e devolve o stop que espera a porta liberar. */
export async function startWebdriver(env: Record<string, string> = {}): Promise<() => Promise<void>> {
    await waitPortFree()

    const proc = spawn('node', ['dist/main.js'], {
        cwd: WEBDRIVER_DIR,
        stdio: 'ignore',
        env: {
            ...process.env,
            WEBDRIVER_TEST_MODE: '1',
            PORT: String(PORTS.webdriver),
            CORS_ORIGIN: FRONTEND_URL,
            // Sem janela por padrão: a suíte roda enquanto alguém trabalha na máquina, e o
            // recorder abrindo Chromium a cada gravação rouba o foco. RECORDER_HEADLESS=0 pra ver.
            RECORDER_HEADLESS: process.env.RECORDER_HEADLESS ?? '1',
            ...env,
        },
    })

    await waitHealthy()

    return async () => {
        const exited = new Promise<void>((r) => proc.once('exit', () => r()))
        proc.kill()
        const term = await Promise.race([
            exited.then(() => true),
            new Promise<false>((r) => setTimeout(() => r(false), 2000)),
        ])
        if (!term) {
            proc.kill('SIGKILL')
            await exited
        }
        await waitPortFree()
    }
}
