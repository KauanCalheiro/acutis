import { test, expect, chromium, type BrowserContext, type Worker } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const EXTENSION_PATH = resolve(import.meta.dirname, '../dist')
const FIXTURE_HTML = readFileSync(resolve(import.meta.dirname, 'fixtures/page.html'))

let server: Server
let baseUrl: string
let context: BrowserContext
let serviceWorker: Worker

test.beforeAll(async () => {
    server = createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(FIXTURE_HTML)
    })
    await new Promise<void>((r) => server.listen(0, r))
    const { port } = server.address() as { port: number }
    baseUrl = `http://127.0.0.1:${port}`

    context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [
            `--disable-extensions-except=${EXTENSION_PATH}`,
            `--load-extension=${EXTENSION_PATH}`,
        ],
    })

    serviceWorker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker')
})

test.afterAll(async () => {
    await context.close()
    await new Promise<void>((r) => server.close(() => r()))
})

test('injects the recorder and captures a click once recording starts', async () => {
    const page = await context.newPage()
    await page.goto(baseUrl)

    const tabId = await serviceWorker.evaluate(async (url) => {
        const [tab] = await chrome.tabs.query({ url: `${url}/*` })
        return tab.id
    }, baseUrl)

    await serviceWorker.evaluate((id) => {
        ;(globalThis as unknown as { capturedMessages: unknown[] }).capturedMessages = []
        chrome.runtime.onMessage.addListener((msg) => {
            ;(globalThis as unknown as { capturedMessages: unknown[] }).capturedMessages.push(msg)
        })
        chrome.tabs.sendMessage(id!, { type: 'START' })
    }, tabId)

    await expect(page.locator('#__acutis_host')).toBeAttached()

    await page.click('#btn')

    await expect
        .poll(() =>
            serviceWorker.evaluate(
                () => (globalThis as unknown as { capturedMessages: Array<{ type: string; event?: { type: string } }> }).capturedMessages
                    .some((m) => m.type === 'RECORD_EVENT' && m.event?.type === 'click'),
            ),
        )
        .toBe(true)
})
