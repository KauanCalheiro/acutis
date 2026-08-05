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

async function inspectVideo(video: string): Promise<{ blankIntro: number | null, duration: number }> {
    const { execFile } = await import('node:child_process')
    const { promisify } = await import('node:util')

    const { stderr } = await promisify(execFile)(
        'ffmpeg',
        ['-hide_banner', '-i', video, '-vf', 'negate,blackdetect=d=0.05:pix_th=0.10', '-map', '0:v', '-f', 'null', '-'],
        { maxBuffer: 10 * 1024 * 1024 },
    )
    const blank = stderr.match(/black_start:0(?:\.0+)? black_end:([\d.]+)/)
    const duration = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/)!

    return {
        blankIntro: blank ? Number(blank[1]) : null,
        duration: Number(duration[1]) * 3600 + Number(duration[2]) * 60 + Number(duration[3]),
    }
}

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
                expect(process.env.USER).toBe('482910')
            })
        `

        const res = await request.post(`${RUNNER_URL}/runner/spec`, {
            data: { spec: envSpec, env: { USER: '482910' } },
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

        const run = async (data: Record<string, unknown>) =>
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

        const overridden = await run({ grep: '@env', env: { PROJECT_SECRET: 'from-dotenv', FROM_ENVIRONMENT: '1' } })
        expect(overridden.passed).toBe(true)

        const losing = await run({ grep: '@env', env: { PROJECT_SECRET: 'do-ambiente' } })
        expect(losing.passed).toBe(false)
    })

    test('streams run progress as ndjson over http', async ({ request }) => {
        test.setTimeout(120_000)

        const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')

        const dir = await mkdtemp(join(tmpdir(), 'acutis-stream-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'),
            "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './tests' })\n")
        await writeFile(join(dir, 'tests', 'ok.spec.ts'),
            "import { test, expect } from '@playwright/test'\ntest('passa', () => { expect(1).toBe(1) })\n")
        await writeFile(join(dir, 'tests', 'nok.spec.ts'),
            "import { test, expect } from '@playwright/test'\ntest('falha', () => { expect(1).toBe(2) })\n")
        await writeFile(join(dir, 'tests', 'skip.spec.ts'),
            "import { test } from '@playwright/test'\ntest.skip('pulado', () => {})\n")

        const res = await request.post(`${RUNNER_URL}/runner/project/stream`, { data: { path: dir }, timeout: 90_000 })
        expect(res.ok()).toBe(true)

        const events = (await res.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line))
        expect(events.map((e) => e.event)).toContain('run:started')

        const tests = events.filter((e) => e.event === 'test')
        expect(tests.some((e) => e.status === 'pending')).toBe(true)
        expect(tests.some((e) => e.status === 'success')).toBe(true)

        const failure = tests.find((e) => e.status === 'failed')
        expect(failure?.title).toBe('falha')
        expect(String(failure?.error)).toContain('expect')

        const skipped = tests.find((e) => e.status === 'skipped')
        expect(skipped?.title).toBe('pulado')

        const pending = tests.find((e) => e.status === 'pending' && e.title === 'falha')
        expect(pending?.id).toBe(failure?.id)

        const finished = events.find((e) => e.event === 'run:finished')
        expect(finished?.passed).toBe(false)
    })

    test('carries the runner output when the run dies before any test reports', async ({ request }) => {
        test.setTimeout(120_000)

        const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')

        const dir = await mkdtemp(join(tmpdir(), 'acutis-sem-teste-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'),
            "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './tests' })\n")
        await writeFile(join(dir, 'tests', 'ok.spec.ts'),
            "import { test } from '@playwright/test'\ntest('passa', () => {})\n")

        // Filtro que não casa arquivo de teste nenhum. É o que acontece quando o config do projeto
        // não conhece o spec pedido (o auth.setup.ts sem o project "setup", por exemplo).
        const res = await request.post(`${RUNNER_URL}/runner/project/stream`, {
            data: { path: dir, spec: 'tests/nao-existe.spec.ts' },
            timeout: 90_000,
        })
        expect(res.ok()).toBe(true)

        const events = (await res.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line))
        const finished = events.find((e) => e.event === 'run:finished')

        expect(finished?.passed).toBe(false)

        await test.step('the reason reaches whoever is listening, not just the process stderr', () => {
            expect(events.filter((e) => e.event === 'step')).toHaveLength(0)
            expect(String(finished?.output)).toContain('No tests found')
        })

        await test.step('and comes clean, without the reporter markers the user should never see', () => {
            expect(String(finished?.output)).not.toContain('@@ACUTIS_RUN@@')
        })
    })

    test('kills a test that runs past the ten second timeout', async ({ request }) => {
        test.setTimeout(120_000)

        const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')

        const dir = await mkdtemp(join(tmpdir(), 'acutis-timeout-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'),
            "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './tests' })\n")
        await writeFile(join(dir, 'tests', 'lento.spec.ts'),
            "import { test } from '@playwright/test'\ntest('demora demais', async () => { await new Promise((resolve) => setTimeout(resolve, 30_000)) })\n")

        const startedAt = Date.now()
        const res = await request.post(`${RUNNER_URL}/runner/project/stream`, { data: { path: dir }, timeout: 90_000 })
        const elapsed = Date.now() - startedAt

        expect(res.ok()).toBe(true)

        const events = (await res.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line))
        const failure = events.find((e) => e.event === 'test' && e.status === 'failed')

        expect(String(failure?.error)).toContain('Test timeout of 10000ms exceeded')
        expect(elapsed, 'o teste lento não pode chegar ao fim dos 30s').toBeLessThan(25_000)
    })

    test('streams test.step progress alongside the test events', async ({ request }) => {
        test.setTimeout(120_000)

        const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')

        const dir = await mkdtemp(join(tmpdir(), 'acutis-stream-steps-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'),
            "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './tests' })\n")
        await writeFile(join(dir, 'tests', 'steps.spec.ts'), [
            "import { test, expect } from '@playwright/test'",
            "test('fluxo com passos', async () => {",
            "    await test.step('passo que passa', () => { expect(1).toBe(1) })",
            "    await test.step('passo que falha', () => { expect(1).toBe(2) }).catch(() => {})",
            '})',
        ].join('\n'))

        const res = await request.post(`${RUNNER_URL}/runner/project/stream`, { data: { path: dir }, timeout: 90_000 })
        expect(res.ok()).toBe(true)

        const events = (await res.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line))
        const steps = events.filter((e) => e.event === 'step')

        expect(steps.some((e) => e.title === 'passo que passa' && e.status === 'pending')).toBe(true)
        expect(steps.some((e) => e.title === 'passo que passa' && e.status === 'success')).toBe(true)

        const failedStep = steps.find((e) => e.title === 'passo que falha' && e.status === 'failed')
        expect(failedStep).toBeTruthy()
        expect(String(failedStep?.error)).toContain('expect')

        const started = events.find((e) => e.event === 'run:started')
        expect(started?.steps).toEqual(['passo que passa', 'passo que falha'])
    })

    test('records and serves a video of every run, passing or failing, without the project asking for it', async ({ page, request }) => {
        test.setTimeout(180_000)

        const { mkdtemp, mkdir, readFile, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')
        const { createServer } = await import('node:http')

        const server = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end('<!doctype html><html><head><style>'
                + '@keyframes pulso { from { background: #101820 } to { background: #2b6cb0 } }'
                + 'body { margin: 0; height: 100vh; animation: pulso 0.4s infinite alternate }'
                + '</style></head><body>ok</body></html>')
        })
        await new Promise<void>((r) => server.listen(0, r))
        const { port } = server.address() as { port: number }

        const dir = await mkdtemp(join(tmpdir(), 'acutis-stream-video-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'), [
            "import { defineConfig } from '@playwright/test'",
            'export default defineConfig({',
            "    testDir: './tests',",
            `    use: { baseURL: 'http://127.0.0.1:${port}' },`,
            '})',
        ].join('\n'))
        await writeFile(join(dir, 'tests', 'visita.spec.ts'), [
            "import { test } from '@playwright/test'",
            "test('visita a página', async ({ page }) => {",
            "    await test.step('abre a página', async () => { await page.goto('/') })",
            "    await page.waitForTimeout(3000)",
            '})',
        ].join('\n'))
        await writeFile(join(dir, 'tests', 'quebra.spec.ts'), [
            "import { test, expect } from '@playwright/test'",
            "test('quebra na página', async ({ page }) => {",
            "    await page.goto('/')",
            "    await expect(page.locator('#nao-existe')).toBeVisible({ timeout: 3000 })",
            '})',
        ].join('\n'))

        try {
            const res = await request.post(`${RUNNER_URL}/runner/project/stream`, { data: { path: dir }, timeout: 120_000 })
            expect(res.ok()).toBe(true)

            const events = (await res.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line))

            for (const status of ['success', 'failed']) {
                const finishedTest = events.find((e) => e.event === 'test' && e.status === status)
                expect(finishedTest?.videoPath, `vídeo do teste ${status}`).toBeTruthy()

                const videoRes = await request.get(`${RUNNER_URL}/runner/video`, { params: { path: finishedTest.videoPath } })
                expect(videoRes.ok()).toBe(true)
                expect(videoRes.headers()['content-type']).toBe('video/webm')
                expect((await videoRes.body()).length).toBeGreaterThan(0)

                const partial = await request.get(`${RUNNER_URL}/runner/video`, {
                    params: { path: finishedTest.videoPath },
                    headers: { Range: 'bytes=0-99' },
                })
                expect(partial.status(), `range do vídeo ${status}`).toBe(206)
                expect(partial.headers()['content-range']).toMatch(/^bytes 0-99\//)

                const src = `${RUNNER_URL}/runner/video?path=${encodeURIComponent(finishedTest.videoPath)}`
                await page.setContent(`<video src="${src}" preload="metadata"></video>`)

                const preview = page.locator('video')
                await expect
                    .poll(() => preview.evaluate((el: HTMLVideoElement) => el.readyState), { timeout: 15_000 })
                    .toBeGreaterThanOrEqual(1)

                await preview.evaluate((el: HTMLVideoElement) => { el.currentTime = el.duration * 0.25 })
                await expect
                    .poll(() => preview.evaluate((el: HTMLVideoElement) => el.readyState >= 2 && el.currentTime > 0), { timeout: 15_000 })
                    .toBe(true)

                const served = join(dir, `served-${status}.webm`)
                await writeFile(served, await videoRes.body())

                const raw = await inspectVideo(finishedTest.videoPath)
                const watchable = await inspectVideo(served)
                const detail = `vídeo ${status}, bruto ${JSON.stringify(raw)}, servido ${JSON.stringify(watchable)}`

                expect(watchable.blankIntro, detail).toBeNull()
            }

            const config = await readFile(join(dir, 'playwright.config.ts'), 'utf8')
            expect(config).toContain("mode: 'on'")
            expect(config).toContain('actions')
            expect(config).toContain('slowMo')
        } finally {
            await new Promise<void>((r) => server.close(() => r()))
        }
    })

    test('holds the app alive after the last action, but only for runs it drives', async ({ request }) => {
        test.setTimeout(180_000)

        const { mkdtemp, mkdir, readFile, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')
        const { execFile } = await import('node:child_process')
        const { promisify } = await import('node:util')

        const dir = await mkdtemp(join(tmpdir(), 'acutis-tail-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'),
            "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './tests' })\n")
        await writeFile(join(dir, 'tests', 'rapido.spec.ts'), [
            "import { test } from '@playwright/test'",
            "test('acaba rapido', async ({ page }) => {",
            "    await page.goto('data:text/html,<body>ok</body>')",
            '})',
        ].join('\n'))

        const res = await request.post(`${RUNNER_URL}/runner/project/stream`, { data: { path: dir }, timeout: 120_000 })
        const events = (await res.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line))
        const finishedTest = events.find((e) => e.event === 'test' && e.status === 'success')

        expect(finishedTest?.durationMs, 'o runner segura a página no final').toBeGreaterThanOrEqual(1500)
        expect(await readFile(join(dir, 'tests', 'rapido.spec.ts'), 'utf8')).toContain("from '../acutis-run'")

        const { stdout } = await promisify(execFile)('npx', ['playwright', 'test', '--reporter=json'], {
            cwd: dir,
            env: { ...process.env, PLAYWRIGHT_HTML_OPEN: 'never' },
            maxBuffer: 10 * 1024 * 1024,
        })

        const direct = JSON.parse(stdout).suites[0].specs[0].tests[0].results[0].duration
        expect(direct, 'rodando direto pelo projeto não segura a página').toBeLessThan(1500)
    })

    test('upgrades a project already recording plain video to the annotated one', async ({ request }) => {
        test.setTimeout(60_000)

        const { mkdtemp, mkdir, readFile, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')

        const dir = await mkdtemp(join(tmpdir(), 'acutis-plain-video-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'), [
            "import { defineConfig } from '@playwright/test'",
            'export default defineConfig({',
            "    testDir: './tests',",
            '    use: {',
            "        video: 'on',",
            '    },',
            '})',
        ].join('\n'))

        await request.post(`${RUNNER_URL}/runner/project`, { data: { path: dir, grep: '@nenhum' }, timeout: 45_000 })

        const config = await readFile(join(dir, 'playwright.config.ts'), 'utf8')
        expect(config).not.toContain("video: 'on'")
        expect(config).toContain("mode: 'on'")
        expect(config).toContain('actions')
        expect(config).toContain('fontSize: 1')
        expect(config).toContain('slowMo')
    })

    test('keeps a run video that never rendered anything instead of trimming it away', async ({ request }) => {
        test.setTimeout(120_000)

        const { mkdtemp, mkdir, writeFile } = await import('node:fs/promises')
        const { tmpdir } = await import('node:os')
        const { join } = await import('node:path')

        const dir = await mkdtemp(join(tmpdir(), 'acutis-blank-video-'))
        await mkdir(join(dir, 'tests'), { recursive: true })
        await writeFile(join(dir, 'playwright.config.ts'),
            "import { defineConfig } from '@playwright/test'\nexport default defineConfig({ testDir: './tests' })\n")
        await writeFile(join(dir, 'tests', 'em-branco.spec.ts'), [
            "import { test } from '@playwright/test'",
            "test('nunca navega', async ({ page }) => { await page.waitForTimeout(700) })",
        ].join('\n'))

        const res = await request.post(`${RUNNER_URL}/runner/project/stream`, { data: { path: dir }, timeout: 90_000 })
        const events = (await res.text()).split('\n').filter(Boolean).map((line) => JSON.parse(line))
        const finishedTest = events.find((e) => e.event === 'test' && e.status === 'success')
        expect(finishedTest?.videoPath).toBeTruthy()

        const raw = await inspectVideo(finishedTest.videoPath)
        expect(raw.blankIntro, 'o fixture precisa gravar um vídeo todo em branco').toBeGreaterThan(raw.duration * 0.9)

        const served = join(dir, 'served.webm')
        const videoRes = await request.get(`${RUNNER_URL}/runner/video`, { params: { path: finishedTest.videoPath } })
        await writeFile(served, await videoRes.body())
        expect((await inspectVideo(served)).duration).toBeCloseTo(raw.duration, 1)
    })
})
