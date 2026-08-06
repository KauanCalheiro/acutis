import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { startBackend } from '../support/backend'
import { projectsCopy } from '../support/projects'
import { startWebdriver, WEBDRIVER_URL } from '../support/webdriver'
import { chromium } from '@playwright/test'
import type { ChildProcess } from 'node:child_process'
import { spawn } from 'node:child_process'

const FIXTURE_HTML = readFileSync(resolve(import.meta.dirname, '../fixtures/page.html'))

let fixtureServer: Server
let fixtureBaseUrl: string
let stopWebdriver: () => Promise<void>

type GatewayMessage = { event: string } & Record<string, unknown>

interface GatewayClient {
    send: (type: string, payload?: Record<string, unknown>) => void
    waitForMessage: (predicate: (message: GatewayMessage) => boolean) => Promise<GatewayMessage>
    received: () => GatewayMessage[]
    close: () => void
}

async function connectGateway(): Promise<GatewayClient> {
    const ws = new WebSocket(`${WEBDRIVER_URL.replace('http', 'ws')}/ws`)
    const messages: GatewayMessage[] = []
    const waiters: Array<() => boolean> = []

    ws.addEventListener('message', (e) => {
        messages.push(JSON.parse(String(e.data)) as GatewayMessage)
        for (let i = waiters.length - 1; i >= 0; i--) {
            if (waiters[i]()) waiters.splice(i, 1)
        }
    })
    await new Promise<void>((resolve, reject) => {
        ws.addEventListener('open', () => resolve())
        ws.addEventListener('error', () => reject(new Error('gateway connection failed')))
    })

    return {
        send: (type, payload) => ws.send(JSON.stringify({ type, ...payload })),
        received: () => [...messages],
        waitForMessage: (predicate) => new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('timed out waiting for gateway message')), 10_000)
            const check = () => {
                const found = messages.find(predicate)
                if (!found) return false
                clearTimeout(timer)
                resolve(found)
                return true
            }
            if (!check()) waiters.push(check)
        }),
        close: () => ws.close(),
    }
}

test.describe('recording gateway events', { tag: ['@write', '@recording'] }, () => {
    test.beforeAll(async () => {
        fixtureServer = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(FIXTURE_HTML)
        })
        await new Promise<void>((r) => fixtureServer.listen(0, r))
        const { port } = fixtureServer.address() as { port: number }
        fixtureBaseUrl = `http://127.0.0.1:${port}`

        stopWebdriver = await startWebdriver()
    })

    test.afterAll(async () => {
        await stopWebdriver()
        await new Promise<void>((r) => fixtureServer.close(() => r()))
    })

    test('reports a fill event when the recorded page is filled via the debug endpoint', async ({ request }) => {
        const gateway = await connectGateway()

        try {
            await test.step('start recording through the gateway', async () => {
                gateway.send('START_RECORDING')
            })

            await test.step('navigate the recorded browser to the fixture site via the debug endpoint', async () => {
                const res = await request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: fixtureBaseUrl } })
                expect(res.ok()).toBe(true)
            })

            await test.step('fill the name input via the debug endpoint', async () => {
                const res = await request.post(`${WEBDRIVER_URL}/debug/fill`, { data: { selector: '#name', value: 'Ana' } })
                expect(res.ok()).toBe(true)
            })

            await test.step('assert the fill event arrives on the gateway with the typed value', async () => {
                const message = await gateway.waitForMessage((m) => m.event === 'recorder:fill')
                expect(message.value).toBe('Ana')
                expect(message.selectors).toMatchObject({ id: 'name' })
            })

            await test.step('stop recording through the gateway', async () => {
                gateway.send('STOP_RECORDING')
                await gateway.waitForMessage((m) => m.event === 'recorder:stop')
            })
        } finally {
            gateway.close()
        }
    })

    test('masks password fields by default (scenario recording)', async ({ request }) => {
        const gateway = await connectGateway()

        try {
            gateway.send('START_RECORDING')

            const goto = await request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: fixtureBaseUrl } })
            expect(goto.ok()).toBe(true)

            const fill = await request.post(`${WEBDRIVER_URL}/debug/fill`, { data: { selector: '#password', value: 's3cr3t' } })
            expect(fill.ok()).toBe(true)

            const message = await gateway.waitForMessage((m) => m.event === 'recorder:fill')
            expect(message.value).toBe('••••')
            expect(message.inputType).toBe('password')

            gateway.send('STOP_RECORDING')
            await gateway.waitForMessage((m) => m.event === 'recorder:stop')
        } finally {
            gateway.close()
        }
    })

    test('reports the real password value when recording in auth mode', async ({ request }) => {
        const gateway = await connectGateway()

        try {
            gateway.send('START_RECORDING', { mode: 'auth' })

            const goto = await request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: fixtureBaseUrl } })
            expect(goto.ok()).toBe(true)

            const fill = await request.post(`${WEBDRIVER_URL}/debug/fill`, { data: { selector: '#password', value: 's3cr3t' } })
            expect(fill.ok()).toBe(true)

            const message = await gateway.waitForMessage((m) => m.event === 'recorder:fill')
            expect(message.value).toBe('s3cr3t')
            expect(message.inputType).toBe('password')

            gateway.send('STOP_RECORDING')
            await gateway.waitForMessage((m) => m.event === 'recorder:stop')
        } finally {
            gateway.close()
        }
    })
})

test.describe('scenario recording from the project page', { tag: ['@write', '@recording'] }, () => {
    let scenarioFixtureServer: Server
    let scenarioBaseUrl: string
    let stopScenarioWebdriver: () => Promise<void>
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        scenarioFixtureServer = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(FIXTURE_HTML)
        })
        await new Promise<void>((r) => scenarioFixtureServer.listen(0, r))
        const { port } = scenarioFixtureServer.address() as { port: number }
        scenarioBaseUrl = `http://127.0.0.1:${port}`

        stopScenarioWebdriver = await startWebdriver()

        tmpProjects = projectsCopy(scenarioBaseUrl)
        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    test.afterAll(async () => {
        await stopScenarioWebdriver()
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
        await new Promise<void>((r) => scenarioFixtureServer.close(() => r()))
    })

    test.beforeEach(async ({ page }) => {
        await test.step('open the project page and wait for the webdriver connection', async () => {
            await page.goto('/projects/alpha-store')
            await page.locator('[data-hydrated="true"]').waitFor()
            await expect(page.getByTestId('cenario-novo')).toBeEnabled({ timeout: 10_000 })
        })

        await test.step('start recording straight from the new scenario button', async () => {
            await page.getByTestId('cenario-novo').click()
            await expect(page.getByTestId('cenario-parar')).toBeVisible({ timeout: 10_000 })
        })

        await test.step('interact with the recorded browser via the debug endpoints', async () => {
            const goto = await page.request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: scenarioBaseUrl } })
            expect(goto.ok()).toBe(true)
            const click = await page.request.post(`${WEBDRIVER_URL}/debug/click`, { data: { selector: '#btn' } })
            expect(click.ok()).toBe(true)
        })

        await test.step('stop recording and land on the review modal', async () => {
            await page.getByTestId('cenario-parar').click()
            await expect(page.getByTestId('revisao-video')).toBeVisible({ timeout: 10_000 })
        })
    })

    test('reviews the recording with video and event timeline', async ({ page }) => {
        await expect(page.getByTestId('revisao-evento').filter({ hasText: 'Click me' })).toBeVisible()

        await test.step('clicking an event seeks the video and marks it as current', async () => {
            const item = page.getByTestId('revisao-evento').filter({ hasText: 'Click me' })
            await item.click()
            await expect(item).toHaveAttribute('data-current', 'true')
        })
    })

    test('cancel dismisses the review without creating a scenario', async ({ page }) => {
        await page.getByTestId('revisao-cancelar').click()

        await expect(page.getByTestId('revisao-video')).toBeHidden()
        await expect(page.getByTestId('cenario-card')).toHaveCount(2)
    })

    test('writes the recorded dom next to the spec, which is where the fixer reads it later', async ({ page }) => {
        await page.route('**/api/projects/alpha-store/tests/draft', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    title: 'Fluxo gravado',
                    tags: ['@read'],
                    domain: 'navegacao',
                    path: 'fluxo-gravado',
                    gherkin: '@read\nFuncionalidade: Fluxo gravado',
                    playwright: "import { test } from '@playwright/test' // spec",
                }),
            })
        })

        await test.step('send the draft, letting the real backend write it to disk', async () => {
            await page.getByTestId('revisao-gerar').click()
            await expect(page.getByTestId('contexto-titulo')).toHaveValue('Fluxo gravado', { timeout: 10_000 })

            const written = page.waitForResponse(
                (r) => r.url().endsWith('/api/projects/alpha-store/tests') && r.request().method() === 'POST',
            )

            await page.getByTestId('contexto-enviar').click()
            expect((await written).status()).toBe(200)
        })

        const dom = JSON.parse(
            readFileSync(join(tmpProjects, 'alpha-store', 'tests', 'navegacao', 'fluxo-gravado.dom.json'), 'utf8'),
        )

        expect(Object.values(dom).join('\n')).toContain('id="btn"')
    })

    test('shows the generation warnings with the draft, pointing at the environment', async ({ page }) => {
        await page.route('**/api/projects/alpha-store/tests/draft', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    title: 'Fluxo gravado',
                    tags: ['@read'],
                    domain: 'navegacao',
                    path: 'fluxo-gravado',
                    gherkin: '@read\nFuncionalidade: Fluxo gravado',
                    playwright: "import { test } from '@playwright/test' // spec",
                    warnings: ['env-sem-valor: A variável TOKEN está declarada sem valor; preencha o ambiente ou o teste falha.'],
                }),
            })
        })

        await page.getByTestId('revisao-gerar').click()

        const ressalvas = page.getByTestId('geracao-ressalvas')

        await test.step('the warning shows the reason without the rule slug', async () => {
            await expect(ressalvas).toBeVisible({ timeout: 10_000 })
            await expect(ressalvas).toContainText('A variável TOKEN está declarada sem valor')
            await expect(ressalvas).not.toContainText('env-sem-valor')
        })

        await test.step('an empty variable offers the environment screen, which is where it is filled', async () => {
            await expect(page.getByTestId('ressalvas-ambiente')).toHaveAttribute('href', '/projects/alpha-store?ambiente')
        })
    })

    test('drafts the scenario, lets the user edit the contexts, then posts the edited draft', async ({ page }) => {
        let drafted: { baseUrl?: string, events?: Array<{ type?: string, html?: string | null }> } | null = null
        await page.route('**/api/projects/alpha-store/tests/draft', async (route) => {
            drafted = route.request().postDataJSON()
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    title: 'Fluxo gravado',
                    tags: ['@read'],
                    domain: 'navegacao',
                    path: 'fluxo-gravado',
                    gherkin: '@read\nFuncionalidade: Fluxo gravado\n  Cenário: clica',
                    playwright: "import { test } from '@playwright/test' // spec",
                }),
            })
        })

        let posted: { title?: string, path?: string, domain?: string, tags?: string[] } | null = null
        await page.route('**/api/projects/alpha-store/tests', async (route) => {
            posted = route.request().postDataJSON()
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ spec: 'tests/x.spec.ts', feature: 'features/x.feature', gherkin: '', playwright: '', testRun: null }),
            })
        })

        await test.step('generate switches to the loading step and requests a draft', async () => {
            await page.getByTestId('revisao-gerar').click()
            await expect(page.getByTestId('contexto-carregando')).toBeVisible()
        })

        await test.step('the editable contexts appear seeded with the AI draft', async () => {
            await expect(page.getByTestId('contexto-titulo')).toHaveValue('Fluxo gravado', { timeout: 10_000 })
            await expect(page.getByTestId('contexto-path')).toHaveValue('fluxo-gravado')
            await expect(page.getByTestId('contexto-dominio')).toHaveValue('navegacao')
        })

        await test.step('the user edits the title before sending', async () => {
            await page.getByTestId('contexto-titulo').fill('Fluxo revisado')
            await page.getByTestId('contexto-enviar').click()
        })

        await expect(page.getByTestId('revisao-video')).toBeHidden({ timeout: 10_000 })
        expect(drafted!.baseUrl).toBe(scenarioBaseUrl)
        expect(drafted!.events!.some((e) => e.type === 'click')).toBe(true)

        await test.step('the dom around the clicked element travels with the event, which is what tells duplicated selectors apart', () => {
            const clicked = drafted!.events!.find((e) => e.type === 'click')

            expect(clicked!.html).toContain('id="btn"')
        })
        expect(posted!.title).toBe('Fluxo revisado')
        expect(posted!.path).toBe('fluxo-gravado')
        expect(posted!.domain).toBe('navegacao')
    })
})

test.describe('recording authentication from the auth scenario page', { tag: ['@write', '@recording'] }, () => {
    let authFixtureServer: Server
    let authBaseUrl: string
    let stopAuthWebdriver: () => Promise<void>
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        authFixtureServer = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(FIXTURE_HTML)
        })
        await new Promise<void>((r) => authFixtureServer.listen(0, r))
        const { port } = authFixtureServer.address() as { port: number }
        authBaseUrl = `http://127.0.0.1:${port}`

        stopAuthWebdriver = await startWebdriver()

        tmpProjects = projectsCopy(authBaseUrl)
        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    test.afterAll(async () => {
        await stopAuthWebdriver()
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
        await new Promise<void>((r) => authFixtureServer.close(() => r()))
    })

    test('records a login, writes the setup and runs it right away', async ({ page }) => {
        let posted: {
            baseUrl?: string
            events?: Array<{ type?: string, value?: string | null, html?: string | null }>
        } | null = null

        await page.route('**/api/projects/alpha-store/auth/record', async (route) => {
            posted = route.request().postDataJSON()
            await new Promise((resolve) => setTimeout(resolve, 1000))
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    authSetup: "import { test as setup } from '@playwright/test' // login gravado",
                    credentialsNeeded: false,
                }),
            })
        })

        await page.route('**/api/projects/alpha-store/run-stream**', async (route) => {
            expect(route.request().url()).toContain('spec=tests%2Fauth.setup.ts')
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: [
                    `data: ${JSON.stringify({ event: 'run:started', steps: ['Faz login'] })}`,
                    '',
                    `data: ${JSON.stringify({ event: 'step', title: 'Faz login', status: 'pending' })}`,
                    '',
                    `data: ${JSON.stringify({ event: 'step', title: 'Faz login', status: 'success', durationMs: 10, error: null })}`,
                    '',
                    `data: ${JSON.stringify({ event: 'run:finished', passed: true })}`,
                    '',
                    '',
                ].join('\n'),
            })
        })

        await test.step('open the auth scenario page and wait for the webdriver connection', async () => {
            await page.goto('/projects/alpha-store/scenarios/auth')
            await page.locator('[data-hydrated="true"]').waitFor()
            await expect(page.getByTestId('auth-gravar-vazio')).toBeEnabled({ timeout: 10_000 })
        })

        await test.step('start recording from the empty state', async () => {
            await page.getByTestId('auth-gravar-vazio').click()
            await expect(page.getByTestId('cenario-parar')).toBeVisible({ timeout: 10_000 })
        })

        await test.step('perform the login in the recorded browser via the debug endpoints', async () => {
            const goto = await page.request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: authBaseUrl } })
            expect(goto.ok()).toBe(true)
            const fill = await page.request.post(`${WEBDRIVER_URL}/debug/fill`, { data: { selector: '#name', value: 'admin' } })
            expect(fill.ok()).toBe(true)
            const fillPassword = await page.request.post(`${WEBDRIVER_URL}/debug/fill`, { data: { selector: '#password', value: 's3cr3t' } })
            expect(fillPassword.ok()).toBe(true)
            const click = await page.request.post(`${WEBDRIVER_URL}/debug/click`, { data: { selector: '#btn' } })
            expect(click.ok()).toBe(true)
        })

        await test.step('stopping the recording writes the setup and executes it', async () => {
            await page.getByTestId('cenario-parar').click()
            await expect(page.getByRole('dialog').getByTestId('auth-carregando'), 'a escrita carrega dentro de uma modal').toBeVisible({ timeout: 15_000 })
            await expect(page.getByTestId('execucao-status')).toBeVisible({ timeout: 15_000 })
        })

        await expect(page.getByTestId('execucao-detalhes')).toContainText('Autenticação')
        expect(posted!.baseUrl).toBe(authBaseUrl)
        expect(posted!.events!.some((e) => e.type === 'fill' && e.value === 'admin')).toBe(true)

        await test.step('the dom around each field travels with the login events too', () => {
            const filled = posted!.events!.find((e) => e.type === 'fill')

            expect(filled!.html).toContain('id="name"')
        })

        await test.step('the real password is forwarded unmasked for this auth-mode recording', () => {
            expect(posted!.events!.some((e) => e.type === 'fill' && e.value === 's3cr3t')).toBe(true)
        })
    })

    test('asks for the credentials when the backend could not extract them', async ({ page }) => {
        let saved: { username?: string, password?: string } | null = null

        await page.route('**/api/projects/alpha-store/auth/record', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    authSetup: "import { test as setup } from '@playwright/test' // login gravado",
                    credentialsNeeded: true,
                }),
            })
        })

        await page.route('**/api/projects/alpha-store/auth/credentials', async (route) => {
            saved = route.request().postDataJSON()
            await route.fulfill({ status: 204, body: '' })
        })

        await page.route('**/api/projects/alpha-store/run-stream**', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'text/event-stream',
                body: `data: ${JSON.stringify({ event: 'run:finished', passed: true })}\n\n`,
            })
        })

        await test.step('open the auth scenario page and wait for the webdriver connection', async () => {
            await page.goto('/projects/alpha-store/scenarios/auth')
            await page.locator('[data-hydrated="true"]').waitFor()
            await expect(page.getByTestId('auth-gravar-vazio')).toBeEnabled({ timeout: 10_000 })
        })

        await test.step('record a login and stop', async () => {
            await page.getByTestId('auth-gravar-vazio').click()
            await expect(page.getByTestId('cenario-parar')).toBeVisible({ timeout: 10_000 })

            const goto = await page.request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: authBaseUrl } })
            expect(goto.ok()).toBe(true)
            const click = await page.request.post(`${WEBDRIVER_URL}/debug/click`, { data: { selector: '#btn' } })
            expect(click.ok()).toBe(true)

            await page.getByTestId('cenario-parar').click()
        })

        await test.step('the page asks for the credentials instead of running', async () => {
            await expect(page.getByTestId('auth-credenciais')).toBeVisible({ timeout: 15_000 })

            await page.getByTestId('auth-credenciais-usuario').fill('482910')
            await page.getByTestId('auth-credenciais-senha').fill('senha-real')
            await page.getByTestId('auth-credenciais-salvar').click()
        })

        await expect(page.getByTestId('execucao-status')).toBeVisible({ timeout: 15_000 })
        expect(saved).toMatchObject({ username: '482910', password: 'senha-real' })
    })

    test('shows the generation warnings on the auth scenario page', async ({ page }) => {
        await page.route('**/api/projects/alpha-store/auth/record', async (route) => {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    authSetup: "import { test as setup } from '@playwright/test' // login gravado",
                    credentialsNeeded: true,
                    warnings: ['env-sem-valor: A variável TOKEN está declarada sem valor; preencha o ambiente ou o teste falha.'],
                }),
            })
        })

        await test.step('open the auth scenario page and wait for the webdriver connection', async () => {
            await page.goto('/projects/alpha-store/scenarios/auth')
            await page.locator('[data-hydrated="true"]').waitFor()
            await expect(page.getByTestId('auth-gravar-vazio')).toBeEnabled({ timeout: 10_000 })
        })

        await test.step('record a login and stop', async () => {
            await page.getByTestId('auth-gravar-vazio').click()
            await expect(page.getByTestId('cenario-parar')).toBeVisible({ timeout: 10_000 })

            const goto = await page.request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: authBaseUrl } })
            expect(goto.ok()).toBe(true)
            const click = await page.request.post(`${WEBDRIVER_URL}/debug/click`, { data: { selector: '#btn' } })
            expect(click.ok()).toBe(true)

            await page.getByTestId('cenario-parar').click()
        })

        await test.step('the warning survives next to the credentials the generation could not extract', async () => {
            await expect(page.getByTestId('auth-credenciais')).toBeVisible({ timeout: 15_000 })
            await expect(page.getByTestId('geracao-ressalvas')).toContainText('A variável TOKEN está declarada sem valor')
        })
    })

    test('keeps the real reason in the console when the backend fails to write the setup', async ({ page }) => {
        const consoleErrors: string[] = []

        page.on('console', (message) => {
            if (message.type() === 'error') consoleErrors.push(message.text())
        })

        await page.route('**/api/projects/alpha-store/auth/record', async (route) => {
            await route.fulfill({
                status: 500,
                contentType: 'application/json',
                body: JSON.stringify({ message: 'Maximum execution time of 30 seconds exceeded' }),
            })
        })

        await test.step('open the auth scenario page and wait for the webdriver connection', async () => {
            await page.goto('/projects/alpha-store/scenarios/auth')
            await page.locator('[data-hydrated="true"]').waitFor()
            await expect(page.getByTestId('auth-gravar-vazio')).toBeEnabled({ timeout: 10_000 })
        })

        await test.step('record a login and stop', async () => {
            await page.getByTestId('auth-gravar-vazio').click()
            await expect(page.getByTestId('cenario-parar')).toBeVisible({ timeout: 10_000 })

            const goto = await page.request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: authBaseUrl } })
            expect(goto.ok()).toBe(true)
            const click = await page.request.post(`${WEBDRIVER_URL}/debug/click`, { data: { selector: '#btn' } })
            expect(click.ok()).toBe(true)

            await page.getByTestId('cenario-parar').click()
        })

        await test.step('the page warns the user and the console carries the failed request', async () => {
            await expect(page.getByTestId('webdriver-erro')).toBeVisible({ timeout: 15_000 })
            await expect.poll(
                () => consoleErrors.find((text) => text.includes('Falha ao gravar a autenticação')) ?? '',
                { timeout: 10_000 },
            ).toContain('500')
        })
    })
})

test.describe('recording over cdp against a host chrome', { tag: ['@write', '@recording'] }, () => {
    const CDP_PORT = 9223
    let cdpFixtureServer: Server
    let cdpBaseUrl: string
    let chromeProcess: ChildProcess
    let chromeProfile: string
    let stopCdpWebdriver: () => Promise<void>

    test.beforeAll(async () => {
        cdpFixtureServer = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(FIXTURE_HTML)
        })
        await new Promise<void>((r) => cdpFixtureServer.listen(0, r))
        const { port } = cdpFixtureServer.address() as { port: number }
        cdpBaseUrl = `http://127.0.0.1:${port}`

        chromeProfile = mkdtempSync(join(tmpdir(), 'acutis-chrome-'))
        chromeProcess = spawn(chromium.executablePath(), [
            `--remote-debugging-port=${CDP_PORT}`,
            `--user-data-dir=${chromeProfile}`,
            '--headless=new',
            '--no-first-run',
            '--no-default-browser-check',
            'about:blank',
        ], { stdio: 'ignore' })

        await expect(async () => {
            const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
            expect(res.ok).toBe(true)
        }).toPass({ timeout: 15_000 })

        stopCdpWebdriver = await startWebdriver({ RECORDER_CDP_URL: `http://127.0.0.1:${CDP_PORT}` })
    })

    test.afterAll(async () => {
        await stopCdpWebdriver()
        const exited = new Promise((r) => chromeProcess.once('exit', r))
        chromeProcess.kill('SIGKILL')
        await exited
        rmSync(chromeProfile, { recursive: true, force: true })
        await new Promise<void>((r) => cdpFixtureServer.close(() => r()))
    })

    test('records through the host browser and keeps it open after stopping', async ({ request }) => {
        const gateway = await connectGateway()

        try {
            await test.step('start recording against the host chrome', async () => {
                gateway.send('START_RECORDING')
            })

            await test.step('drive the recorded tab via the debug endpoints', async () => {
                const goto = await request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: cdpBaseUrl } })
                expect(goto.ok()).toBe(true)
                const click = await request.post(`${WEBDRIVER_URL}/debug/click`, { data: { selector: '#btn' } })
                expect(click.ok()).toBe(true)
            })

            await test.step('assert the click event flows through the gateway', async () => {
                await gateway.waitForMessage((m) => m.event === 'recorder:click')
            })

            const stopMessage = await test.step('stop and receive the video session', async () => {
                gateway.send('STOP_RECORDING')
                return gateway.waitForMessage((m) => m.event === 'recorder:stop')
            })

            await test.step('assert the video was captured over cdp', async () => {
                expect(stopMessage.sessionId).toBeTruthy()
                const video = await request.get(`${WEBDRIVER_URL}/recording/${stopMessage.sessionId}`)
                expect(video.ok()).toBe(true)
                expect(video.headers()['content-type']).toBe('video/webm')
            })

            await test.step('assert the host chrome survived the recording session', async () => {
                const version = await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`)
                expect(version.ok).toBe(true)
            })
        } finally {
            gateway.close()
        }
    })
})

test.describe('recording error when the host chrome is unreachable', { tag: ['@write', '@recording'] }, () => {
    let stopBadWebdriver: () => Promise<void>
    let stopBackend: () => Promise<void>
    let tmpProjects: string

    test.beforeAll(async () => {
        stopBadWebdriver = await startWebdriver({ RECORDER_CDP_URL: 'http://127.0.0.1:9997' })

        tmpProjects = projectsCopy()
        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: tmpProjects })
    })

    test.afterAll(async () => {
        await stopBadWebdriver()
        await stopBackend()
        rmSync(tmpProjects, { recursive: true, force: true })
    })

    test('surfaces a clear error on the project page and resets the button', async ({ page }) => {
        await test.step('open the project page and wait for the webdriver connection', async () => {
            await page.goto('/projects/alpha-store')
            await page.locator('[data-hydrated="true"]').waitFor()
            await expect(page.getByTestId('cenario-novo')).toBeEnabled({ timeout: 10_000 })
        })

        await page.getByTestId('cenario-novo').click()

        await expect(page.getByTestId('webdriver-erro')).toContainText('Chrome', { timeout: 10_000 })
        await expect(page.getByTestId('cenario-novo')).toBeVisible()
    })

    test('offers a copyable per-os chrome command that reopens the current page', async ({ page }) => {
        await test.step('trigger the connection error', async () => {
            await page.goto('/projects/alpha-store')
            await page.locator('[data-hydrated="true"]').waitFor()
            await expect(page.getByTestId('cenario-novo')).toBeEnabled({ timeout: 10_000 })
            await page.getByTestId('cenario-novo').click()
            await expect(page.getByTestId('webdriver-erro')).toBeVisible({ timeout: 10_000 })
        })

        await test.step('assert the command targets the debug port and lands back on this page', async () => {
            await expect(page.getByTestId('webdriver-comando')).toContainText('remote-debugging-port=9222')
            await expect(page.getByTestId('webdriver-comando')).toContainText('/projects/alpha-store')
        })

        await test.step('assert switching os swaps the command', async () => {
            await page.getByRole('tab', { name: 'Windows' }).click()
            await expect(page.getByTestId('webdriver-comando')).toContainText('Start-Process')
        })

        await test.step('copy the command to the clipboard', async () => {
            await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
            await page.getByTestId('webdriver-copiar').click()
            const copied = await page.evaluate(() => navigator.clipboard.readText())
            expect(copied).toContain('remote-debugging-port=9222')
        })
    })
})

test.describe('recording a scenario with the project session already loaded', { tag: ['@write', '@recording'] }, () => {
    let sessionFixtureServer: Server
    let sessionBaseUrl: string
    let stopSessionWebdriver: () => Promise<void>
    let tmpProject: string
    let stateFile: string

    test.beforeAll(async () => {
        sessionFixtureServer = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(FIXTURE_HTML)
        })
        await new Promise<void>((r) => sessionFixtureServer.listen(0, r))
        const { port } = sessionFixtureServer.address() as { port: number }
        sessionBaseUrl = `http://127.0.0.1:${port}`

        tmpProject = mkdtempSync(join(tmpdir(), 'acutis-sessao-'))
        stateFile = join(tmpProject, 'storage-state.json')
        writeFileSync(stateFile, JSON.stringify({
            cookies: [],
            origins: [{ origin: sessionBaseUrl, localStorage: [{ name: 'token', value: 'sessao-injetada' }] }],
        }))

        stopSessionWebdriver = await startWebdriver()
    })

    test.afterAll(async () => {
        await stopSessionWebdriver()
        rmSync(tmpProject, { recursive: true, force: true })
        await new Promise<void>((r) => sessionFixtureServer.close(() => r()))
    })

    async function recordAgainst(gateway: { send: (t: string, p?: Record<string, unknown>) => void, waitForMessage: (f: (m: GatewayMessage) => boolean) => Promise<GatewayMessage> }, request: { post: (url: string, opts: { data: unknown }) => Promise<{ ok: () => boolean }> }, payload?: Record<string, unknown>) {
        gateway.send('START_RECORDING', payload)

        await expect(async () => {
            const goto = await request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: sessionBaseUrl } })
            expect(goto.ok()).toBe(true)
        }).toPass({ timeout: 20_000 })

        gateway.send('STOP_RECORDING')

        return gateway.waitForMessage((message) => message.event === 'recorder:stop')
    }

    test('opens the recorded browser already authenticated when given the project session', async ({ request }) => {
        const gateway = await connectGateway()

        try {
            const stopped = await recordAgainst(gateway, request, { storageState: stateFile })
            const state = stopped.storageState as { origins: Array<{ localStorage: Array<{ name: string, value: string }> }> } | null

            await test.step('the injected session is live in the recorded page, without anyone logging in', () => {
                expect(state?.origins.some(
                    (origin) => origin.localStorage.some((item) => item.name === 'token' && item.value === 'sessao-injetada'),
                )).toBe(true)
            })
        } finally {
            gateway.close()
        }
    })

    test('refuses to record when the session file it was told to load does not exist', async () => {
        const gateway = await connectGateway()

        try {
            gateway.send('START_RECORDING', { storageState: join(tmpProject, 'storage-state.inexistente.json') })
            const failure = await gateway.waitForMessage((message) => message.event === 'recorder:error')

            expect(String(failure.error)).toContain('storage-state.inexistente.json')
        } finally {
            gateway.close()
        }
    })

    test('opens the recorded browser straight at the project url, without anyone typing it', async ({ request }) => {
        const gateway = await connectGateway()

        try {
            gateway.send('START_RECORDING', { url: sessionBaseUrl })

            const navigated = await gateway.waitForMessage(
                (message) => message.event === 'recorder:navigate' && String(message.url ?? '').startsWith(sessionBaseUrl),
            )

            expect(navigated.url).toContain(sessionBaseUrl)
        } finally {
            gateway.send('STOP_RECORDING')
            await gateway.waitForMessage((message) => message.event === 'recorder:stop').catch(() => {})
            gateway.close()
        }
    })

    test('records the page it ended on, and never the blank page', async ({ request }) => {
        const gateway = await connectGateway()

        try {
            gateway.send('START_RECORDING')

            await expect(async () => {
                const goto = await request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: sessionBaseUrl } })
                expect(goto.ok()).toBe(true)
            }).toPass({ timeout: 20_000 })

            await test.step('navigate somewhere else, so the last page differs from the first', async () => {
                const goto = await request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: `${sessionBaseUrl}/ultima` } })
                expect(goto.ok()).toBe(true)
            })

            gateway.send('STOP_RECORDING')
            await gateway.waitForMessage((message) => message.event === 'recorder:stop')

            const urls = gateway.received()
                .filter((message) => message.type === 'navigate')
                .map((message) => message.url)

            expect(urls).not.toContain('about:blank')
            expect(urls[urls.length - 1]).toBe(`${sessionBaseUrl}/ultima`)
        } finally {
            gateway.close()
        }
    })

    test('starts clean when no session is given', async ({ request }) => {
        const gateway = await connectGateway()

        try {
            const stopped = await recordAgainst(gateway, request)
            const state = stopped.storageState as { origins: Array<{ localStorage: Array<{ name: string }> }> } | null

            expect(state?.origins.some((origin) => origin.localStorage.some((item) => item.name === 'token'))).toBeFalsy()
        } finally {
            gateway.close()
        }
    })
})
