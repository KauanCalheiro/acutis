import { Injectable } from '@nestjs/common'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { access, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { RUNNER_DIR } from '../config/paths.js'

export interface RunResult {
    passed: boolean
    output: string
    storageState?: unknown
}

export interface RunOptions {
    baseUrl?: string
    env?: Record<string, string>
}

const RUN_TIMEOUT_MS = 60_000
const STORAGE_STATE_FILE = 'storage-state.json'
const WEBDRIVER_ROOT = resolve(import.meta.dirname, '../..')

@Injectable()
export class RunnerService {
    async run(spec: string, options: RunOptions = {}): Promise<RunResult> {
        const dir = join(RUNNER_DIR, randomUUID())
        await mkdir(dir, { recursive: true })
        await writeFile(join(dir, 'generated.spec.ts'), spec)

        if (options.baseUrl) {
            await writeFile(join(dir, 'playwright.config.ts'), [
                "import { defineConfig } from '@playwright/test'",
                '',
                `export default defineConfig({ use: { baseURL: ${JSON.stringify(options.baseUrl)} } })`,
                '',
            ].join('\n'))
        }

        try {
            const result = await this.execPlaywright(dir, ['--reporter=line'], options.env)
            const storageState = await this.readStorageState(dir)

            return storageState === undefined ? result : { ...result, storageState }
        } finally {
            await rm(dir, { recursive: true, force: true })
        }
    }

    async runProject(dir: string, options: { spec?: string; grep?: string } = {}): Promise<RunResult> {
        await this.ensureNodeModules(dir)

        const args: string[] = []
        if (options.spec) args.push(options.spec)
        if (options.grep) args.push('--grep', options.grep)

        return this.execPlaywright(dir, args, await this.readDotenv(dir))
    }

    private async readDotenv(dir: string): Promise<Record<string, string>> {
        let raw: string
        try {
            raw = await readFile(join(dir, '.env'), 'utf8')
        } catch {
            return {}
        }

        const env: Record<string, string> = {}
        for (const line of raw.split('\n')) {
            const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
            if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, '')
        }

        return env
    }

    private async ensureNodeModules(dir: string): Promise<void> {
        const link = join(dir, 'node_modules')

        try {
            await access(link)
        } catch {
            await symlink(join(WEBDRIVER_ROOT, 'node_modules'), link, 'dir')
        }
    }

    private async readStorageState(dir: string): Promise<unknown> {
        try {
            return JSON.parse(await readFile(join(dir, STORAGE_STATE_FILE), 'utf8'))
        } catch {
            return undefined
        }
    }

    private execPlaywright(dir: string, args: string[] = [], env?: Record<string, string>): Promise<RunResult> {
        return new Promise((resolvePromise) => {
            const child = spawn('npx', ['playwright', 'test', ...args], {
                cwd: dir,
                env: {
                    ...process.env,
                    ...env,
                    PLAYWRIGHT_HTML_OPEN: 'never',
                    NODE_PATH: join(WEBDRIVER_ROOT, 'node_modules'),
                },
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
