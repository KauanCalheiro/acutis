import { test, expect } from '@playwright/test'

function connectFakeExtension(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
        const socket = new WebSocket('ws://localhost:3000/_ws?source=extension-bg')
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
})
