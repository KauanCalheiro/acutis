import { Injectable } from '@nestjs/common'
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import type { Dirent } from 'node:fs'
import { access, mkdir, readdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { RUNNER_DIR, STREAM_REPORTER_PATH } from '../config/paths.js'
import type { RunEvent } from '../types/run.js'

export interface RunResult {
    passed: boolean
    output: string
    storageState?: unknown
}

export interface RunOptions {
    baseUrl?: string
    env?: Record<string, string>
}

export interface ProjectRunOptions {
    spec?: string
    grep?: string
    env?: Record<string, string>
}

const RUN_TIMEOUT_MS = 120_000
const PROJECT_RUN_TIMEOUT_MS = 300_000
/**
 * Rodamos com slowMo, vídeo e trace ligados pra execução ser assistível, então o relógio do teste
 * corre bem mais devagar que o do Playwright puro: um cenário de cinco passos passa de 10s só com a
 * lentidão que nós mesmos injetamos. O kill do processo fica sempre acima disto, senão a execução
 * morre antes do reporter contar o que houve.
 */
const TEST_TIMEOUT = ['--timeout', '30000']
const STORAGE_STATE_FILE = 'storage-state.json'
const STREAM_MARKER = '@@ACUTIS_RUN@@'

/**
 * As linhas de marcador são o canal de eventos do reporter, não mensagem para gente ler. Sem
 * tirá-las, o erro que a interface mostra ao usuário vem cheio de JSON interno.
 */
function withoutMarkers(output: string): string {
    return output
        .split('\n')
        .filter((line) => !line.includes(STREAM_MARKER))
        .join('\n')
        .trim()
}
const UNREADABLE_ACTION_LABEL = 1
const ANNOTATED_VIDEO = `video: { mode: 'on', show: { actions: { duration: 500, fontSize: ${UNREADABLE_ACTION_LABEL} }, test: { level: 'step' } } },`
const VIDEO_WE_WROTE = /\bvideo\s*:\s*(?:'on'|\{ mode: 'on'[^\n]*\})\s*,?/
const WATCHABLE_RUN_SETTINGS = [
    { present: /\bvideo\s*:/, setting: ANNOTATED_VIDEO },
    { present: /\blaunchOptions\s*:/, setting: 'launchOptions: { slowMo: 500 },' },
]
const WEBDRIVER_ROOT = resolve(import.meta.dirname, '../..')
const RUN_TAIL_MS = 1500
const RUN_TAIL_ENV = 'ACUTIS_RUN_TAIL_MS'
const WRAPPER_FILE = 'acutis-run.ts'
const WRAPPER_SOURCE = [
    "import { test as base } from '@playwright/test'",
    '',
    "export * from '@playwright/test'",
    '',
    `const TAIL_MS = Number(process.env.${RUN_TAIL_ENV} ?? 0)`,
    '',
    'export const test = base.extend<{ acutisTail: void }>({',
    '    acutisTail: [async ({ page }, use) => {',
    '        await use()',
    '        if (TAIL_MS > 0) await page.waitForTimeout(TAIL_MS).catch(() => {})',
    '    }, { auto: true }],',
    '})',
    '',
].join('\n')
const PLAYWRIGHT_IMPORT = /(from\s+['"])@playwright\/test(['"])/g
const TESTS_DIR = 'tests'

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

    async runProject(dir: string, options: ProjectRunOptions = {}): Promise<RunResult> {
        await this.ensureNodeModules(dir)
        await this.ensureWatchableRun(dir)
        await this.ensureRunTail(dir)

        const args = [...TEST_TIMEOUT]
        if (options.spec) args.push(options.spec)
        if (options.grep) args.push('--grep', options.grep)

        return this.execPlaywright(dir, args, await this.projectEnv(dir, options.env))
    }

    async streamProject(
        dir: string,
        options: ProjectRunOptions,
        onEvent: (event: RunEvent) => void,
    ): Promise<RunResult> {
        await this.ensureNodeModules(dir)
        await this.ensureWatchableRun(dir)
        await this.ensureRunTail(dir)
        const env = await this.projectEnv(dir, options.env)

        const args = [`--reporter=${STREAM_REPORTER_PATH}`, ...TEST_TIMEOUT]
        if (options.spec) args.push(options.spec)
        if (options.grep) args.push('--grep', options.grep)

        return new Promise((resolvePromise) => {
            const child = spawn('npx', ['playwright', 'test', ...args], {
                cwd: dir,
                env: { ...process.env, ...env, PLAYWRIGHT_HTML_OPEN: 'never', [RUN_TAIL_ENV]: String(RUN_TAIL_MS), NODE_PATH: join(WEBDRIVER_ROOT, 'node_modules') },
            })

            let output = ''
            let buffer = ''

            child.stdout.on('data', (chunk: Buffer) => {
                const text = chunk.toString()
                output += text
                buffer += text

                const lines = buffer.split('\n')
                buffer = lines.pop() ?? ''

                for (const line of lines) {
                    const marker = line.indexOf(STREAM_MARKER)
                    if (marker < 0) continue
                    try {
                        onEvent(JSON.parse(line.slice(marker + STREAM_MARKER.length)) as RunEvent)
                    } catch { /* linha parcial/ruído */ }
                }
            })
            child.stderr.on('data', (chunk: Buffer) => { output += chunk.toString() })

            const timer = setTimeout(() => child.kill('SIGKILL'), PROJECT_RUN_TIMEOUT_MS)

            child.on('close', (code) => {
                clearTimeout(timer)
                resolvePromise({ passed: code === 0, output: withoutMarkers(output) })
            })
        })
    }

    private async projectEnv(dir: string, resolved?: Record<string, string>): Promise<Record<string, string>> {
        return { ...await this.readDotenv(dir), ...resolved }
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

    private async ensureWatchableRun(dir: string): Promise<void> {
        const file = join(dir, 'playwright.config.ts')

        let original: string
        try {
            original = await readFile(file, 'utf8')
        } catch {
            return
        }

        const source = original.replace(VIDEO_WE_WROTE, ANNOTATED_VIDEO)

        const missing = WATCHABLE_RUN_SETTINGS
            .filter(({ present }) => !present.test(source))
            .map(({ setting }) => `\n        ${setting}`)
            .join('')

        const withUse = missing === ''
            ? source
            : source.replace(/\buse\s*:\s*\{[ \t]*\n?[ \t]*/, `use: {${missing}\n        `)

        const patched = missing === '' || withUse !== source
            ? withUse
            : source.replace(/\bdefineConfig\(\{/, `defineConfig({\n    use: {${missing}\n    },`)

        if (patched !== original) await writeFile(file, patched)
    }

    private async ensureRunTail(dir: string): Promise<void> {
        const wrapper = join(dir, WRAPPER_FILE)

        try {
            if (await readFile(wrapper, 'utf8') !== WRAPPER_SOURCE) {
                await writeFile(wrapper, WRAPPER_SOURCE)
            }
        } catch {
            await writeFile(wrapper, WRAPPER_SOURCE)
        }

        let entries: Dirent[]
        try {
            entries = await readdir(join(dir, TESTS_DIR), { recursive: true, withFileTypes: true })
        } catch {
            return
        }

        for (const entry of entries) {
            if (!entry.isFile() || !entry.name.endsWith('.ts')) continue

            const file = join(entry.parentPath, entry.name)
            const source = await readFile(file, 'utf8')
            if (!PLAYWRIGHT_IMPORT.test(source)) continue

            const target = relative(entry.parentPath, join(dir, 'acutis-run'))
            const patched = source.replace(PLAYWRIGHT_IMPORT, `$1${target.startsWith('.') ? target : `./${target}`}$2`)

            if (patched !== source) await writeFile(file, patched)
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
