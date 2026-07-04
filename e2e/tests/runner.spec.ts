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
})
