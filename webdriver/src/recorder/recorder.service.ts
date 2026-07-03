import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { chromium, type BrowserContext, type Page } from 'playwright'
import { RECORDER_BUNDLE_PATH } from '../config/paths.js'
import { VideoService } from '../video/video.service.js'
import type { RecordingEvent } from '../types/recording.js'

export interface StopResult {
    sessionId: string | null
}

@Injectable()
export class RecorderService {
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

        const browser = await chromium.launch()
        this.context = await browser.newContext()
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

        await this.context.close()
        this.context = null
        this.page = null
        this.sessionId = null
        this.ready = false

        return { sessionId: wasScreencasting ? sessionId : null }
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
}
