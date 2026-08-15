import assert from 'node:assert/strict'
import { spawn, type ChildProcess } from 'node:child_process'
import { copyFileSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { resolve } from 'node:path'

const WEBDRIVER_DIR = resolve(import.meta.dirname, '../../backend')
const WEBDRIVER_URL = 'http://localhost:4400'
const SAMPLE_APP_HTML = readFileSync(resolve(import.meta.dirname, '../fixtures/sample-app.html'))
const OUTPUT_DIR = resolve(import.meta.dirname, '../fixtures/sample-recording')

type GatewayMessage = { event: string } & Record<string, unknown>
type CapturedEvent = { type: string } & Record<string, unknown>

async function ensurePortIsFree(): Promise<void> {
    const alreadyListening = await fetch(`${WEBDRIVER_URL}/health`).then(() => true).catch(() => false)
    if (alreadyListening) {
        throw new Error(`something is already listening on ${WEBDRIVER_URL} — stop it before capturing`)
    }
}

async function waitForWebdriver(): Promise<void> {
    for (let i = 0; i < 50; i++) {
        const healthy = await fetch(`${WEBDRIVER_URL}/health`).then((res) => res.ok).catch(() => false)
        if (healthy) return
        await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('webdriver did not become healthy in time')
}

function startSampleAppServer(): Promise<{ server: Server; baseUrl: string }> {
    return new Promise((resolvePromise) => {
        const server = createServer((_req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(SAMPLE_APP_HTML)
        })
        server.listen(0, () => {
            const { port } = server.address() as { port: number }
            resolvePromise({ server, baseUrl: `http://127.0.0.1:${port}` })
        })
    })
}

interface Gateway {
    events: CapturedEvent[]
    send: (type: string) => void
    waitFor: (description: string, predicate: (message: GatewayMessage) => boolean) => Promise<GatewayMessage>
    close: () => void
}

async function connectGateway(): Promise<Gateway> {
    const ws = new WebSocket(`${WEBDRIVER_URL.replace('http', 'ws')}/ws`)
    const messages: GatewayMessage[] = []
    const events: CapturedEvent[] = []
    const waiters: Array<() => boolean> = []

    ws.addEventListener('message', (e) => {
        const message = JSON.parse(String(e.data)) as GatewayMessage
        messages.push(message)
        if (typeof message.type === 'string') {
            const { event: _event, ...captured } = message
            events.push(captured as CapturedEvent)
        }
        for (let i = waiters.length - 1; i >= 0; i--) {
            if (waiters[i]()) waiters.splice(i, 1)
        }
    })
    await new Promise<void>((resolvePromise, reject) => {
        ws.addEventListener('open', () => resolvePromise())
        ws.addEventListener('error', () => reject(new Error('gateway connection failed')))
    })

    return {
        events,
        send: (type) => ws.send(JSON.stringify({ type })),
        waitFor: (description, predicate) => new Promise((resolvePromise, reject) => {
            const timer = setTimeout(() => reject(new Error(`timed out waiting for: ${description}`)), 15_000)
            const check = () => {
                const found = messages.find(predicate)
                if (!found) return false
                clearTimeout(timer)
                resolvePromise(found)
                return true
            }
            if (!check()) waiters.push(check)
        }),
        close: () => ws.close(),
    }
}

async function post(path: string, data: Record<string, string>): Promise<void> {
    const res = await fetch(`${WEBDRIVER_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    })
    if (!res.ok) throw new Error(`POST ${path} failed with ${res.status}: ${await res.text()}`)
}

function eventOf(message: GatewayMessage): CapturedEvent {
    return message as unknown as CapturedEvent
}

function selectorId(message: GatewayMessage): string | null {
    return (message.selectors as { id: string | null } | null)?.id ?? null
}

async function fillAndWait(gateway: Gateway, selector: string, value: string): Promise<void> {
    const id = selector.slice(1)
    await post('/debug/fill', { selector, value })
    await gateway.waitFor(`fill event on ${selector}`, (m) => eventOf(m).type === 'fill' && selectorId(m) === id)
}

async function clickAndWait(gateway: Gateway, selector: string): Promise<void> {
    const id = selector.slice(1)
    await post('/debug/click', { selector })
    await gateway.waitFor(`click event on ${selector}`, (m) => eventOf(m).type === 'click' && selectorId(m) === id)
}

async function capture(): Promise<void> {
    await ensurePortIsFree()

    const { server, baseUrl } = await startSampleAppServer()
    const webdriver: ChildProcess = spawn('node', ['dist/main.js'], {
        cwd: WEBDRIVER_DIR,
        stdio: 'ignore',
        env: { ...process.env, WEBDRIVER_TEST_MODE: '1' },
    })

    try {
        await waitForWebdriver()
        const gateway = await connectGateway()
        const recordedAt = new Date().toISOString()

        gateway.send('START_RECORDING')
        await post('/debug/goto', { url: `${baseUrl}/` })
        await gateway.waitFor('navigate to login', (m) => eventOf(m).type === 'navigate')

        await fillAndWait(gateway, '#name', 'Ana Souza')
        await fillAndWait(gateway, '#email', 'ana.souza@exemplo.com')
        await fillAndWait(gateway, '#password', 'segredo-forte-123')
        await clickAndWait(gateway, '#remember')

        await post('/debug/click', { selector: '#sign-in' })
        await gateway.waitFor('submit of the login form', (m) => eventOf(m).type === 'submit')
        await gateway.waitFor('navigate to catalog', (m) => eventOf(m).type === 'navigate' && String(m.url).endsWith('/app'))

        await fillAndWait(gateway, '#search', 'teclado')
        await clickAndWait(gateway, '#product-keyboard')
        await clickAndWait(gateway, '#add-to-cart')

        await post('/debug/click', { selector: '#logout' })
        await gateway.waitFor('navigate back to login', (m) => {
            const navigations = gateway.events.filter((e) => e.type === 'navigate' && !String(e.url).endsWith('/app'))
            return eventOf(m).type === 'navigate' && navigations.length >= 2
        })

        gateway.send('STOP_RECORDING')
        const stop = await gateway.waitFor('recorder stop', (m) => m.event === 'recorder:stop')
        gateway.close()

        const sessionId = stop.sessionId as string | null
        assert.ok(sessionId, 'recording stopped without a session id — no video was produced')

        mkdirSync(OUTPUT_DIR, { recursive: true })
        const videoSource = resolve(WEBDRIVER_DIR, '.tmp/videos', `${sessionId}.webm`)
        copyFileSync(videoSource, resolve(OUTPUT_DIR, 'recording.webm'))

        const envelope = {
            sessionId,
            baseUrl,
            recordedAt,
            video: 'recording.webm',
            events: gateway.events,
        }
        writeFileSync(resolve(OUTPUT_DIR, 'recording.json'), `${JSON.stringify(envelope, null, 4)}\n`)

        const types = new Set(gateway.events.map((e) => e.type))
        assert.ok(gateway.events.length >= 10, `expected at least 10 events, got ${gateway.events.length}`)
        for (const required of ['navigate', 'fill', 'click', 'submit']) {
            assert.ok(types.has(required), `expected at least one ${required} event`)
        }
        assert.ok(statSync(resolve(OUTPUT_DIR, 'recording.webm')).size > 0, 'recording.webm is empty')

        console.log(`captured ${gateway.events.length} events from session ${sessionId} into ${OUTPUT_DIR}`)
    } finally {
        webdriver.kill()
        server.closeAllConnections()
        server.close()
    }
}

try {
    await capture()
    process.exit(0)
} catch (error) {
    console.error(error)
    process.exit(1)
}
