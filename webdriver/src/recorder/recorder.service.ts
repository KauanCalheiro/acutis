import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { RECORDER_CDP_URL } from '../config/env.js'
import { RECORDER_BUNDLE_PATH } from '../config/paths.js'
import { VideoService } from '../video/video.service.js'
import type { RecordingEvent } from '../types/recording.js'

export interface StopResult {
    sessionId: string | null
}

@Injectable()
export class RecorderService {
    private browser: Browser | null = null
    private overCdp = false
    private context: BrowserContext | null = null
    private page: Page | null = null
    private sessionId: string | null = null
    private screencastStarted = false
    private ready = false

    constructor(private readonly videoService: VideoService) { }

    isRecording(): boolean {
        return this.context !== null
    }

    async start(
        onEvent: (event: RecordingEvent) => void,
        onStarted: (recordingStartedAt: number) => void,
        onRequestStop: () => void,
    ): Promise<void> {
        this.sessionId = randomUUID()
        this.screencastStarted = false
        this.ready = false
        await this.videoService.ensureDir()

        if (RECORDER_CDP_URL) {
            try {
                this.browser = await chromium.connectOverCDP(await this.resolveCdpUrl(RECORDER_CDP_URL))
            } catch {
                throw new Error(
                    `Não foi possível conectar ao Chrome em ${RECORDER_CDP_URL}. `
                    + 'Abra o Chrome do host com --remote-debugging-port=9222 e um --user-data-dir dedicado.',
                )
            }
            this.overCdp = true
            this.context = this.browser.contexts()[0] ?? await this.browser.newContext()
        } else {
            this.browser = await chromium.launch({ headless: false })
            this.overCdp = false
            this.context = await this.browser.newContext()
        }
        this.page = await this.context.newPage()

        await this.page.exposeFunction('__acutisReportEvent', onEvent)
        await this.page.exposeFunction('__acutisRequestStop', onRequestStop)

        await this.context.addInitScript({ path: RECORDER_BUNDLE_PATH })

        this.ready = true

        const sessionId = this.sessionId
        const videoPath = this.videoService.path(sessionId)

        this.page.on('framenavigated', (frame) => {
            if (!this.page || frame !== this.page.mainFrame() || this.screencastStarted) return
            if (frame.url() === 'about:blank') return
            this.screencastStarted = true
            const recordingStartedAt = Date.now()
            void this.page.screencast.start({ path: videoPath }).then(() => onStarted(recordingStartedAt))
        })
    }

    async stop(): Promise<StopResult> {
        if (!this.context) {
            return { sessionId: null }
        }

        const sessionId = this.sessionId
        const wasScreencasting = this.screencastStarted

        if (wasScreencasting && this.page) {
            try { await this.page.screencast.stop() } catch { /* já parado */ }
        }

        if (this.overCdp) {
            try { await this.page?.close() } catch { /* já fechada */ }
            try { await this.browser?.close() } catch { /* só desconecta do Chrome do host */ }
        } else {
            await this.context.close()
            try { await this.browser?.close() } catch { /* já fechado */ }
        }
        this.browser = null
        this.context = null
        this.page = null
        this.sessionId = null
        this.ready = false

        return { sessionId: wasScreencasting ? sessionId : null }
    }

    /** O DevTools do Chrome rejeita Host header que não seja IP/localhost — hostnames como host.docker.internal viram IP. */
    private async resolveCdpUrl(rawUrl: string): Promise<string> {
        const url = new URL(rawUrl)
        if (url.hostname === 'localhost' || isIP(url.hostname)) return rawUrl

        const { address, family } = await lookup(url.hostname, { family: 4 })
            .catch(() => lookup(url.hostname))
        url.hostname = family === 6 ? `[${address}]` : address

        return url.toString()
    }

    private async waitForPage(timeoutMs = 5000): Promise<Page> {
        const deadline = Date.now() + timeoutMs
        while (!this.ready || !this.page) {
            if (Date.now() > deadline) throw new Error('not recording')
            await new Promise((r) => setTimeout(r, 50))
        }
        return this.page
    }

    async debugGoto(url: string): Promise<void> {
        const page = await this.waitForPage()
        await page.goto(url)
    }

    async debugClick(selector: string): Promise<void> {
        const page = await this.waitForPage()
        await page.click(selector)
    }

    async debugFill(selector: string, value: string): Promise<void> {
        const page = await this.waitForPage()
        await page.fill(selector, value)
        await page.locator(selector).blur()
    }
}
