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
        } finally {
            await new Promise<void>((r) => server.close(() => r()))
        }
    })
})
