import { test, expect, chromium } from '@playwright/test'
import { createServer, type Server } from 'node:http'
import { statSync } from 'node:fs'

const FIXTURE_HTML = `<!doctype html>
<html>
<body>
<button id="btn">Click me</button>
</body>
</html>`

test.describe('native recording poc', { tag: ['@write', '@recording'] }, () => {
    test('injects a pill, transmits click events and records video without any permission prompt', async () => {
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

        const capturedEvents: Array<{ type: string; tagName: string }> = []

        const browser = await test.step('launch a plain chromium, no extension', async () => chromium.launch())

        const context = await test.step('open a context with video recording on', async () =>
            browser.newContext({ recordVideo: { dir: 'test-results/poc-videos' } }))

        const page = await context.newPage()

        await test.step('expose a function so the injected pill can transmit events out', async () => {
            await page.exposeFunction('__acutisReportEvent', (event: { type: string; tagName: string }) => {
                capturedEvents.push(event)
            })
        })

        await test.step('inject the pill + click listener before any navigation', async () => {
            await context.addInitScript(() => {
                document.addEventListener('DOMContentLoaded', () => {
                    const pill = document.createElement('div')
                    pill.id = '__acutis_poc_pill'
                    Object.assign(pill.style, {
                        position: 'fixed', top: '0', right: '0', padding: '4px 8px',
                        background: '#ff4444', color: 'white', zIndex: '999999',
                    })
                    pill.textContent = 'REC'
                    document.body.appendChild(pill)
                })

                document.addEventListener('click', (e) => {
                    if (!(e.target instanceof Element)) return
                    ;(window as unknown as { __acutisReportEvent: (event: object) => void }).__acutisReportEvent({
                        type: 'click',
                        tagName: e.target.tagName.toLowerCase(),
                    })
                }, true)
            })
        })

        await test.step('navigate and click, with no permission prompt in the way', async () => {
            await page.goto(baseUrl)
            await expect(page.locator('#__acutis_poc_pill')).toBeVisible()
            await page.click('#btn')
        })

        await test.step('assert the click event was transmitted out of the page', async () => {
            expect(capturedEvents).toEqual([{ type: 'click', tagName: 'button' }])
        })

        const videoPath = await test.step('close the context and resolve the recorded video path', async () => {
            const path = await page.video()?.path()
            await context.close()
            await browser.close()
            return path
        })

        await test.step('assert a real video file was produced', async () => {
            expect(videoPath).toBeTruthy()
            expect(statSync(videoPath!).size).toBeGreaterThan(0)
        })

        await new Promise<void>((r) => server.close(() => r()))
    })
})
