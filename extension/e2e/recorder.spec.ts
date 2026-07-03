import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test'
import { createServer, type Server, type IncomingMessage } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const EXTENSION_PATH = resolve(import.meta.dirname, '../dist')
const FIXTURE_HTML = readFileSync(resolve(import.meta.dirname, 'fixtures/page.html'))
const FIXTURE_TITLE = 'acutis-e2e-fixture'

function readBody(req: IncomingMessage): Promise<Buffer> {
    return new Promise((resolve) => {
        const chunks: Buffer[] = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks)))
    })
}

let server: Server
let baseUrl: string
let context: BrowserContext
let serviceWorker: Worker
const uploadedRecordings = new Map<string, Buffer>()

test.beforeAll(async () => {
    server = createServer((req, res) => {
        const match = req.url?.match(/^\/recording\/([\w-]+)$/)
        if (req.method === 'POST' && match) {
            void readBody(req).then((body) => {
                uploadedRecordings.set(match[1], body)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
            })
            return
        }
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(FIXTURE_HTML)
    })
    await new Promise<void>((r) => server.listen(0, r))
    const { port } = server.address() as { port: number }
    baseUrl = `http://127.0.0.1:${port}`

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

test.afterAll(async () => {
    await context.close()
    await new Promise<void>((r) => server.close(() => r()))
})

test.describe('recorder content script', { tag: ['@write', '@recording'] }, () => {
    test('injects the recorder and captures a click once recording starts', async () => {
        const page = await context.newPage()
        await page.goto(baseUrl)

        const tabId = await test.step('resolve the fixture tab id', async () =>
            serviceWorker.evaluate(async (url) => {
                const [tab] = await chrome.tabs.query({ url: `${url}/*` })
                return tab.id
            }, baseUrl))

        await test.step('simulate the background telling the content script to start', async () => {
            await serviceWorker.evaluate((id) => {
                ;(globalThis as unknown as { capturedMessages: unknown[] }).capturedMessages = []
                chrome.runtime.onMessage.addListener((msg) => {
                    ;(globalThis as unknown as { capturedMessages: unknown[] }).capturedMessages.push(msg)
                })
                chrome.tabs.sendMessage(id!, { type: 'START', sessionId: 'test-session', frontendUrl: 'http://unused.invalid' })
            }, tabId)
        })

        await test.step('assert the recorder pill attaches to the page', async () => {
            await expect(page.locator('#__acutis_host')).toBeAttached()
        })

        await test.step('click a button on the page', async () => {
            await page.click('#btn')
        })

        await test.step('assert a click RECORD_EVENT reaches the background', async () => {
            await expect
                .poll(() =>
                    serviceWorker.evaluate(
                        () => (globalThis as unknown as { capturedMessages: Array<{ type: string; event?: { type: string } }> }).capturedMessages
                            .some((m) => m.type === 'RECORD_EVENT' && m.event?.type === 'click'),
                    ),
                )
                .toBe(true)
        })

        await page.close()
    })
})

test.describe('screen capture on first click', { tag: ['@write', '@recording'] }, () => {
    test('records the tab via getDisplayMedia and uploads the video on stop', async () => {
        const page = await context.newPage()
        await page.goto(baseUrl)
        await page.evaluate((title) => { document.title = title }, FIXTURE_TITLE)

        const sessionId = crypto.randomUUID()

        const tabId = await test.step('resolve the fixture tab id', async () =>
            serviceWorker.evaluate(async (url) => {
                const [tab] = await chrome.tabs.query({ url: `${url}/*` })
                return tab.id
            }, baseUrl))

        await test.step('tell the content script recording started for this session', async () => {
            await serviceWorker.evaluate(({ id, sessionId, frontendUrl }) => {
                chrome.tabs.sendMessage(id!, { type: 'START', sessionId, frontendUrl })
            }, { id: tabId, sessionId, frontendUrl: baseUrl })
        })

        await test.step('click the page, which should trigger getDisplayMedia via the auto-select flag', async () => {
            await page.click('#btn')
        })

        await test.step('let MediaRecorder gather a chunk', async () => {
            await page.waitForTimeout(1500)
        })

        await test.step('stop recording and let the content script upload the video', async () => {
            await serviceWorker.evaluate((id) => {
                chrome.tabs.sendMessage(id!, { type: 'STOP' })
            }, tabId)
        })

        await test.step('assert the recorded video was uploaded for this session', async () => {
            await expect
                .poll(() => uploadedRecordings.get(sessionId)?.byteLength ?? 0, { timeout: 10_000 })
                .toBeGreaterThan(0)
        })

        await page.close()
    })
})
