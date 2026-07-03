import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const EXTENSION_PATH = resolve(import.meta.dirname, '../../extension/dist')
const FIXTURE_HTML = readFileSync(resolve(import.meta.dirname, '../fixtures/page.html'))
const FIXTURE_TITLE = 'acutis-e2e-recorded-site'
const FRONTEND_URL = 'http://localhost:3000'

function connectFakeExtension(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket(`${FRONTEND_URL.replace('http', 'ws')}/_ws?source=extension-bg`)
        socket.addEventListener('open', () => resolve(socket), { once: true })
        socket.addEventListener('error', reject, { once: true })
    })
}

function send(socket: WebSocket, data: object): void {
    socket.send(JSON.stringify(data))
}

test.describe('recording view', { tag: ['@write', '@recording'] }, () => {
    test('shows live events and the recorded video once the session stops', async ({ page, request }) => {
        let fakeExtension: WebSocket | null = null

        await test.step('open the record page and wait for hydration', async () => {
            await page.goto('/record')
            await page.locator('[data-hydrated="true"]').waitFor()
        })

        await test.step('connect a fake extension over the ws relay', async () => {
            fakeExtension = await connectFakeExtension()
            send(fakeExtension, { event: 'recorder:hello', recording: false })
        })

        await test.step('assert the frontend shows the extension as connected', async () => {
            await expect(page.getByText('Extensão conectada')).toBeVisible()
        })

        await test.step('send a click event through the relay', async () => {
            send(fakeExtension!, {
                event: 'recorder:click',
                type: 'click',
                url: 'http://localhost:3000/some-page',
                label: null,
                value: null,
                selectors: { cssStable: '#checkout-button', text: null, dataTestId: null },
            })
        })

        await test.step('assert the click event appears in the live event list', async () => {
            await expect(page.getByTestId('record-events')).toContainText('#checkout-button')
        })

        const sessionId = crypto.randomUUID()

        await test.step('upload a recorded video for this session', async () => {
            const response = await request.post(`/recording/${sessionId}`, {
                data: Buffer.from('fake-webm-bytes-for-e2e'),
                headers: { 'Content-Type': 'video/webm' },
            })
            expect(response.ok()).toBe(true)
        })

        await test.step('send stop with the session id through the relay', async () => {
            send(fakeExtension!, { event: 'recorder:stop', sessionId })
        })

        await test.step('assert the recorded video shows up in the page', async () => {
            const video = page.getByTestId('record-video')
            await expect(video).toBeVisible()
            await expect(video).toHaveAttribute('src', `/recording/${sessionId}`)
        })

        await test.step('assert the uploaded video is actually servable', async () => {
            const response = await request.get(`/recording/${sessionId}`)
            expect(response.ok()).toBe(true)
            expect(response.headers()['content-type']).toBe('video/webm')
        })

        fakeExtension?.close()
    })

    test('records a real video with the extension and plays it back on the record page', async ({ page: controlPage }) => {
        let fixtureServer: Server
        let fixtureBaseUrl: string
        let context: BrowserContext
        let serviceWorker: Worker
        const sessionId = crypto.randomUUID()

        await test.step('serve the fixture site to be recorded', async () => {
            fixtureServer = createServer((_req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(FIXTURE_HTML)
            })
            await new Promise<void>((r) => fixtureServer.listen(0, r))
            const { port } = fixtureServer.address() as { port: number }
            fixtureBaseUrl = `http://127.0.0.1:${port}`
        })

        await test.step('launch chromium with the real extension loaded', async () => {
            context = await chromium.launchPersistentContext('', {
                headless: false,
                recordVideo: { dir: 'test-results/videos' },
                args: [
                    `--disable-extensions-except=${EXTENSION_PATH}`,
                    `--load-extension=${EXTENSION_PATH}`,
                    `--auto-select-tab-capture-source-by-title=${FIXTURE_TITLE}`,
                ],
            })
            serviceWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
        })

        const recordedPage = await test.step('open the fixture site in the extension-loaded browser', async () => {
            const p = await context.newPage()
            await p.goto(fixtureBaseUrl)
            return p
        })

        const tabId = await test.step('resolve the fixture tab id', async () =>
            serviceWorker.evaluate(async (url) => {
                const [tab] = await chrome.tabs.query({ url: `${url}/*` })
                return tab.id
            }, fixtureBaseUrl))

        await test.step('tell the content script recording started for this session', async () => {
            await serviceWorker.evaluate(({ id, sessionId, frontendUrl }) => {
                chrome.tabs.sendMessage(id!, { type: 'START', sessionId, frontendUrl })
            }, { id: tabId, sessionId, frontendUrl: FRONTEND_URL })
        })

        await test.step('click the fixture page to trigger getDisplayMedia', async () => {
            await recordedPage.click('#btn')
        })

        await test.step('let MediaRecorder gather a few chunks', async () => {
            await recordedPage.waitForTimeout(2000)
        })

        await test.step('stop recording and let the content script upload the real video', async () => {
            await serviceWorker.evaluate((id) => {
                chrome.tabs.sendMessage(id!, { type: 'STOP' })
            }, tabId)
        })

        await test.step('wait for the real video upload to land on the frontend', async () => {
            await expect
                .poll(async () => {
                    const res = await controlPage.request.get(`/recording/${sessionId}`)
                    return res.ok()
                }, { timeout: 10_000 })
                .toBe(true)
        })

        await test.step('open the record page and relay recorder:stop so it picks up the real video', async () => {
            await controlPage.goto('/record')
            await controlPage.locator('[data-hydrated="true"]').waitFor()
            const fakeExtension = await connectFakeExtension()
            send(fakeExtension, { event: 'recorder:hello', recording: false })
            send(fakeExtension, { event: 'recorder:stop', sessionId })
            fakeExtension.close()
        })

        await test.step('assert the real recorded video is visible and playable on the page', async () => {
            const video = controlPage.getByTestId('record-video')
            await expect(video).toBeVisible()
            await expect(video).toHaveAttribute('src', `/recording/${sessionId}`)
            await controlPage.waitForFunction(
                () => {
                    const el = document.querySelector('[data-testid="record-video"]') as HTMLVideoElement | null
                    return !!el && el.readyState >= 2
                },
                undefined,
                { timeout: 10_000 },
            )
        })

        await context.close()
        await new Promise<void>((r) => fixtureServer.close(() => r()))
    })
})
