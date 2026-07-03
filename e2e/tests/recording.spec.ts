import { test, expect } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { spawn, type ChildProcess } from 'node:child_process'

const FIXTURE_HTML = readFileSync(resolve(import.meta.dirname, '../fixtures/page.html'))
const WEBDRIVER_DIR = resolve(import.meta.dirname, '../../webdriver')
const WEBDRIVER_URL = 'http://localhost:4000'

async function waitForWebdriver(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        try {
            const res = await fetch(`${WEBDRIVER_URL}/health`)
            if (res.ok) return
        } catch { /* ainda subindo */ }
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('webdriver did not become healthy in time')
}

let fixtureServer: Server
let fixtureBaseUrl: string
let webdriverProcess: ChildProcess

test.describe('recording view', { tag: ['@write', '@recording'] }, () => {
    test.beforeAll(async () => {
        fixtureServer = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(FIXTURE_HTML)
        })
        await new Promise<void>((r) => fixtureServer.listen(0, r))
        const { port } = fixtureServer.address() as { port: number }
        fixtureBaseUrl = `http://127.0.0.1:${port}`

        webdriverProcess = spawn('node', ['dist/main.js'], {
            cwd: WEBDRIVER_DIR,
            stdio: 'ignore',
            env: { ...process.env, WEBDRIVER_TEST_MODE: '1' },
        })
        await waitForWebdriver()
    })

    test.afterAll(async () => {
        webdriverProcess.kill()
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

        await test.step('assert the video is directly servable from the webdriver', async () => {
            const src = await page.getByTestId('record-video').getAttribute('src')
            const response = await request.get(src!)
            expect(response.ok()).toBe(true)
            expect(response.headers()['content-type']).toBe('video/webm')
        })
    })
})
