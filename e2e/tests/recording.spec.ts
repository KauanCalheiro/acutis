import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFileSync, cpSync, mkdtempSync, rmSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { tmpdir } from 'node:os'
import { startBackend } from '../support/backend'
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
    send: (type: string) => void
    waitForMessage: (predicate: (message: GatewayMessage) => boolean) => Promise<GatewayMessage>
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
        send: (type) => ws.send(JSON.stringify({ type })),
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

test.describe('recording view', { tag: ['@write', '@recording'] }, () => {
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

    test('shows live events and the recorded video once the webdriver session stops', async ({ page, request }) => {
        await test.step('open the record page and wait for hydration', async () => {
            await page.goto('/record')
            await page.locator('[data-hydrated="true"]').waitFor()
        })

        await test.step('assert the frontend connects to the webdriver', async () => {
            await expect(page.getByText('Webdriver conectado')).toBeVisible()
        })

        await test.step('start recording', async () => {
            await page.getByTestId('record-start').click()
        })

        await test.step('navigate the recorded browser to the fixture site via the debug endpoint', async () => {
            const res = await request.post(`${WEBDRIVER_URL}/debug/goto`, { data: { url: fixtureBaseUrl } })
            expect(res.ok()).toBe(true)
        })

        await test.step('click the recorded page via the debug endpoint, which reports the event and starts the video', async () => {
            const res = await request.post(`${WEBDRIVER_URL}/debug/click`, { data: { selector: '#btn' } })
            expect(res.ok()).toBe(true)
        })

        await test.step('assert the click event appears in the live event list', async () => {
            await expect(page.getByTestId('record-events')).toContainText('Click me', { timeout: 10_000 })
        })

        await test.step('stop recording', async () => {
            await page.getByTestId('record-stop').click()
        })

        await test.step('assert the recorded video shows up and is playable on the page', async () => {
            const video = page.getByTestId('record-video')
            await expect(video).toBeVisible({ timeout: 10_000 })
            await page.waitForFunction(
                () => {
                    const el = document.querySelector('[data-testid="record-video"]') as HTMLVideoElement | null
                    return !!el && el.readyState >= 2
                },
                undefined,
                { timeout: 10_000 },
            )
        })

        await test.step('assert the video renders at the recorder viewport size', async () => {
            const size = await page.getByTestId('record-video').evaluate((el) => {
                const video = el as HTMLVideoElement
                return { width: video.videoWidth, height: video.videoHeight }
            })
            expect(size).toEqual({ width: 1280, height: 720 })
        })

        await test.step('assert the video is directly servable from the webdriver', async () => {
            const src = await page.getByTestId('record-video').getAttribute('src')
            const response = await request.get(src!)
            expect(response.ok()).toBe(true)
            expect(response.headers()['content-type']).toBe('video/webm')
        })
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

        tmpProjects = mkdtempSync(join(tmpdir(), 'acutis-projects-'))
        cpSync(resolve(import.meta.dirname, '../fixtures/projects'), tmpProjects, { recursive: true })
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

    test('generate posts the recording to the project tests endpoint', async ({ page }) => {
        let posted: { baseUrl?: string, events?: Array<{ type?: string }> } | null = null
        await page.route('**/api/projects/alpha-store/tests', async (route) => {
            posted = route.request().postDataJSON()
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ spec: 'tests/x.spec.ts', feature: 'features/x.feature', gherkin: '', playwright: '', testRun: null }),
            })
        })

        await page.getByTestId('revisao-gerar').click()

        await expect(page.getByTestId('revisao-video')).toBeHidden({ timeout: 10_000 })
        expect(posted!.baseUrl).toBe(scenarioBaseUrl)
        expect(posted!.events!.some((e) => e.type === 'click')).toBe(true)
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

    test.beforeAll(async () => {
        stopBadWebdriver = await startWebdriver({ RECORDER_CDP_URL: 'http://127.0.0.1:9997' })
        stopBackend = await startBackend({ ACUTIS_PROJECTS_PATH: resolve(import.meta.dirname, '../fixtures/projects') })
    })

    test.afterAll(async () => {
        await stopBadWebdriver()
        await stopBackend()
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
