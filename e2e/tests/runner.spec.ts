import { test, expect } from '@playwright/test'
import { spawn, type ChildProcess } from 'node:child_process'
import { resolve } from 'node:path'

const WEBDRIVER_DIR = resolve(import.meta.dirname, '../../webdriver')
const RUNNER_URL = 'http://localhost:4100'

const PASSING_SPEC = `
import { test, expect } from '@playwright/test'

test('generated spec that passes', () => {
    expect(1 + 1).toBe(2)
})
`

const FAILING_SPEC = `
import { test, expect } from '@playwright/test'

test('generated spec that fails on purpose', () => {
    expect(1 + 1).toBe(3)
})
`

const RELATIVE_URL_SPEC = `
import { test, expect } from '@playwright/test'

test('generated spec navigating with a relative url', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#btn')).toBeVisible()
})
`

async function waitForWebdriver(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        try {
            const res = await fetch(`${RUNNER_URL}/health`)
            if (res.ok) return
        } catch { /* ainda subindo */ }
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('webdriver did not become healthy in time')
}

let webdriverProcess: ChildProcess

test.describe('spec runner', { tag: ['@write', '@runner'] }, () => {
    test.beforeAll(async () => {
        webdriverProcess = spawn('node', ['dist/main.js'], {
            cwd: WEBDRIVER_DIR,
            stdio: 'ignore',
            env: { ...process.env, WEBDRIVER_TEST_MODE: '1', PORT: '4100' },
        })
        await waitForWebdriver()
    })

    test.afterAll(async () => {
        webdriverProcess.kill()
    })

    test('runs a passing spec and reports success', async ({ request }) => {
        test.setTimeout(120_000)

        const res = await request.post(`${RUNNER_URL}/runner/spec`, {
            data: { spec: PASSING_SPEC },
            timeout: 90_000,
        })

        expect(res.ok()).toBe(true)
        const body = await res.json()
        expect(body.passed).toBe(true)
    })

    test('runs a failing spec and reports the error output', async ({ request }) => {
        test.setTimeout(120_000)

        const res = await request.post(`${RUNNER_URL}/runner/spec`, {
            data: { spec: FAILING_SPEC },
            timeout: 90_000,
        })

        expect(res.ok()).toBe(true)
        const body = await res.json()
        expect(body.passed).toBe(false)
        expect(body.output).toContain('generated spec that fails on purpose')
    })

    test('resolves relative navigation against the provided base url', async ({ request }) => {
        test.setTimeout(120_000)

        const { createServer } = await import('node:http')
        const server = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<!doctype html><html><body><button id="btn">Click me</button></body></html>')
        })
        await new Promise<void>((r) => server.listen(0, r))
        const { port } = server.address() as { port: number }

        try {
            const res = await request.post(`${RUNNER_URL}/runner/spec`, {
                data: { spec: RELATIVE_URL_SPEC, baseUrl: `http://127.0.0.1:${port}` },
                timeout: 90_000,
            })

            expect(res.ok()).toBe(true)
            const body = await res.json()
            expect(body.passed).toBe(true)
        } finally {
            await new Promise<void>((r) => server.close(() => r()))
        }
    })

    test('injects env variables into the spec process', async ({ request }) => {
        test.setTimeout(120_000)

        const envSpec = `
            import { test, expect } from '@playwright/test'
            test('reads an injected env var', () => {
                expect(process.env.AUTH_USER).toBe('733787')
            })
        `

        const res = await request.post(`${RUNNER_URL}/runner/spec`, {
            data: { spec: envSpec, env: { AUTH_USER: '733787' } },
            timeout: 90_000,
        })

        expect(res.ok()).toBe(true)
        expect((await res.json()).passed).toBe(true)
    })

    test('returns the storage state a spec produces', async ({ request }) => {
        test.setTimeout(120_000)

        const { createServer } = await import('node:http')
        const server = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<!doctype html><html><body>ok</body></html>')
        })
        await new Promise<void>((r) => server.listen(0, r))
        const { port } = server.address() as { port: number }

        const stateSpec = `
            import { test } from '@playwright/test'
            test('logs in and saves storage state', async ({ page, context }) => {
                await page.goto('/')
                await context.addCookies([{ name: 'acutis_session', value: 'tok-abc', url: 'http://127.0.0.1:${port}' }])
                await context.storageState({ path: 'storage-state.json' })
            })
        `

        try {
            const res = await request.post(`${RUNNER_URL}/runner/spec`, {
                data: { spec: stateSpec, baseUrl: `http://127.0.0.1:${port}` },
                timeout: 90_000,
            })

            expect(res.ok()).toBe(true)
            const body = await res.json()
            expect(body.passed).toBe(true)
            expect(body.storageState).toBeTruthy()
            expect(JSON.stringify(body.storageState)).toContain('acutis_session')
        } finally {
            await new Promise<void>((r) => server.close(() => r()))
        }
    })

    test('captures interactive elements from a page snapshot', async ({ request }) => {
        test.setTimeout(120_000)

        const { createServer } = await import('node:http')
        const server = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<!doctype html><html><head><title>Login</title></head><body>'
                + '<input id="user" name="user" data-testid="login-user" placeholder="usuário" />'
                + '<button data-testid="login-submit">Entrar</button>'
                + '</body></html>')
        })
        await new Promise<void>((r) => server.listen(0, r))
        const { port } = server.address() as { port: number }

        try {
            const res = await request.post(`${RUNNER_URL}/runner/snapshot`, {
                data: { url: `http://127.0.0.1:${port}/` },
                timeout: 90_000,
            })

            expect(res.ok()).toBe(true)
            const body = await res.json()
            expect(body.title).toBe('Login')
            const testIds = body.elements.map((e: { testId: string | null }) => e.testId)
            expect(testIds).toContain('login-user')
            expect(testIds).toContain('login-submit')

            const userField = body.elements.find((e: { testId: string | null }) => e.testId === 'login-user')
            expect(userField.selector).toBe('[data-testid="login-user"]')
        } finally {
            await new Promise<void>((r) => server.close(() => r()))
        }
    })

    test('runs a whole project, by tag, and a single spec', async ({ request }) => {
        test.setTimeout(180_000)

        const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')

        const dir = await mkdtemp(join(tmpdir(), 'acutis-project-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'),
            "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './tests' })\n")
        await writeFile(join(dir, 'tests', 'smoke.spec.ts'),
            "import { test, expect } from '@playwright/test'\ntest('soma @smoke', () => { expect(1 + 1).toBe(2) })\n")
        await writeFile(join(dir, 'tests', 'broken.spec.ts'),
            "import { test, expect } from '@playwright/test'\ntest('quebrado', () => { expect(1).toBe(2) })\n")
        await writeFile(join(dir, '.env'), 'PROJECT_SECRET=from-dotenv\n')
        await writeFile(join(dir, 'tests', 'env.spec.ts'),
            "import { test, expect } from '@playwright/test'\ntest('le o .env do projeto @env', () => { expect(process.env.PROJECT_SECRET).toBe('from-dotenv') })\n")

        const run = async (data: Record<string, string>) =>
            (await request.post(`${RUNNER_URL}/runner/project`, { data: { path: dir, ...data }, timeout: 120_000 })).json()

        const all = await run({})
        expect(all.passed).toBe(false)

        const byTag = await run({ grep: '@smoke' })
        expect(byTag.passed).toBe(true)
        expect(byTag.output).toContain('soma')

        const single = await run({ spec: 'tests/smoke.spec.ts' })
        expect(single.passed).toBe(true)

        const withEnv = await run({ grep: '@env' })
        expect(withEnv.passed).toBe(true)
    })
})
