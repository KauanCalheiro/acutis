import { Injectable } from '@nestjs/common'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { RUNNER_DIR } from '../config/paths.js'

export interface RunResult {
    passed: boolean
    output: string
}

const RUN_TIMEOUT_MS = 60_000
const WEBDRIVER_ROOT = resolve(import.meta.dirname, '../..')

@Injectable()
export class RunnerService {
    async run(spec: string, baseUrl?: string): Promise<RunResult> {
        const dir = join(RUNNER_DIR, randomUUID())
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'generated.spec.ts'), spec)

        if (baseUrl) {
            await writeFile(join(dir, 'playwright.config.ts'), [
                "import { defineConfig } from '@playwright/test'",
                '',
                `export default defineConfig({ use: { baseURL: ${JSON.stringify(baseUrl)} } })`,
                '',
            ].join('\n'))
        }

        try {
            return await this.execPlaywright(dir)
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    }

    private execPlaywright(dir: string): Promise<RunResult> {
        return new Promise((resolvePromise) => {
            const child = spawn('npx', ['playwright', 'test', '--reporter=line'], {
                cwd: dir,
                env: { ...process.env, PLAYWRIGHT_HTML_OPEN: 'never', NODE_PATH: join(WEBDRIVER_ROOT, 'node_modules') },
            })

            let output = ''
            child.stdout.on('data', (chunk: Buffer) => { output += chunk.toString() })
            child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString() })

            const timer = setTimeout(() => {
                child.kill('SIGKILL')
                output += `\n[runner] execution killed after ${RUN_TIMEOUT_MS / 1000}s timeout`
            }, RUN_TIMEOUT_MS)

            child.on('close', (code) => {
                clearTimeout(timer)
                resolvePromise({ passed: code === 0, output })
            })
        })
    }
}
