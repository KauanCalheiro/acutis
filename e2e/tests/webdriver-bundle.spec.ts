import { test, expect, chromium } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'

const RECORDER_BUNDLE_PATH = resolve(import.meta.dirname, '../../webdriver/dist-ui/driver-entry.js')
const FIXTURE_HTML = '<!doctype html><html><body><button id="btn">Click me</button></body></html>'

test.describe('webdriver recorder bundle', { tag: ['@write', '@recording'] }, () => {
    test('mounts the pill and transmits events when injected the same way the webdriver service does', async () => {
        let server: Server

        await test.step('serve a fixture page', async () => {
            server = createServer((_req, res) => {
                res.writeHead(200, { 'Content-Type': 'text/html' })
                res.end(FIXTURE_HTML)
            })
            await new Promise<void>((r) => server.listen(0, r))
        })

        const { port } = server!.address() as { port: number }
        const baseUrl = `http://127.0.0.1:${port}`

        const capturedEvents: unknown[] = []

        const browser = await chromium.launch({ headless: false })
        const context = await browser.newContext()
        const page = await context.newPage()

        await page.exposeFunction('__acutisReportEvent', (event: unknown) => {
            capturedEvents.push(event)
        })

        await test.step('inject the built driver bundle exactly like RecorderService does', async () => {
            await context.addInitScript({ path: RECORDER_BUNDLE_PATH })
        })

        await test.step('navigate to the fixture page', async () => {
            await page.goto(baseUrl)
        })

        await test.step('assert the pill host attaches to the page', async () => {
            await expect(page.locator('#__acutis_host')).toBeAttached({ timeout: 5000 })
        })

        await test.step('click the page and assert the event was transmitted', async () => {
            await page.click('#btn')
            await expect.poll(() => capturedEvents.length).toBeGreaterThan(0)
        })

        await context.close()
        await browser.close()
        await new Promise<void>((r) => server.close(() => r()))
    })
})
