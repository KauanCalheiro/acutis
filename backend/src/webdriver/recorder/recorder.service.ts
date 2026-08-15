import { Injectable } from '@nestjs/common'
import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { existsSync } from 'node:fs'
import { isIP } from 'node:net'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { RECORDER_CDP_URL, RECORDER_HEADLESS } from '../../config/env.js'
import { RECORDER_BUNDLE_PATH } from '../../config/paths.js'
import { VideoService } from '../video/video.service.js'
import type { RecordingEvent } from '../../common/types/recording.js'

export interface StorageState {
    cookies: unknown[]
    origins: unknown[]
}

export interface StopResult {
    sessionId: string | null
    storageState: StorageState | null
}

const RECORDING_VIEWPORT = { width: 1280, height: 720 }

const BLANK = 'about:blank'

@Injectable()
export class RecorderService {
    private browser: Browser | null = null
    private overCdp = false
    private context: BrowserContext | null = null
    private page: Page | null = null

    private report: ((event: RecordingEvent) => void) | null = null

    private lastUrl: string | null = null
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
        mode: 'scenario' | 'auth' = 'scenario',
        storageStatePath?: string,
        url?: string,
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
            // Modo CDP grava no contexto do Chrome do usuário, com a sessão real dele.
            this.context = this.browser.contexts()[0] ?? await this.browser.newContext()
        } else {
            if (storageStatePath && !existsSync(storageStatePath)) {
                throw new Error(
                    `Sessão não encontrada em ${storageStatePath}. `
                    + 'Rode o setup de autenticação do projeto antes de gravar um cenário autenticado.',
                )
            }

            this.browser = await chromium.launch({ headless: RECORDER_HEADLESS })
            this.overCdp = false
            this.context = await this.browser.newContext(
                storageStatePath ? { storageState: storageStatePath } : {},
            )
        }
        this.page = await this.context.newPage()
        await this.page.setViewportSize(RECORDING_VIEWPORT)

        // about:blank aparece ao abrir e ao fechar a janela, e não é passo de teste nenhum.
        this.lastUrl = null
        this.report = (event: RecordingEvent) => {
            if (event.type === 'navigate') {
                if (event.url === BLANK) {
                    return
                }

                this.lastUrl = event.url
            }

            onEvent(event)
        }

        await this.page.exposeFunction('__acutisReportEvent', this.report)
        await this.page.exposeFunction('__acutisRequestStop', onRequestStop)

        await this.context.addInitScript((recorderMode) => {
            (window as unknown as { __acutisRecorderMode?: string }).__acutisRecorderMode = recorderMode
        }, mode)
        await this.context.addInitScript({ path: RECORDER_BUNDLE_PATH })

        this.ready = true

        const sessionId = this.sessionId
        const videoPath = this.videoService.path(sessionId)

        this.page.on('framenavigated', (frame) => {
            if (!this.page || frame !== this.page.mainFrame() || this.screencastStarted) return
            if (frame.url() === BLANK) return
            this.screencastStarted = true
            const recordingStartedAt = Date.now()
            void this.page.screencast.start({ path: videoPath, size: RECORDING_VIEWPORT }).then(() => onStarted(recordingStartedAt))
        })

        if (url) {
            await this.page.goto(url).catch(() => { /* site fora do ar: o usuário navega à mão */ })
        }
    }

    async stop(): Promise<StopResult> {
        if (!this.context) {
            return { sessionId: null, storageState: null }
        }

        const sessionId = this.sessionId
        const wasScreencasting = this.screencastStarted
        const storageState = await this.captureStorageState()

        this.reportFinalUrl()

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

        return { sessionId: wasScreencasting ? sessionId : null, storageState }
    }

    /** Relata a última navegação, que o script injetado pode não ter alcançado antes de parar. */
    private reportFinalUrl(): void {
        const url = this.page?.url()

        if (!this.report || !url || url === BLANK || url === this.lastUrl) {
            return
        }

        this.report({
            type: 'navigate',
            timestamp: Date.now(),
            url,
            html: null,
            checked: null,
            selectors: null,
            label: null,
            value: null,
            sensitive: false,
            tagName: null,
            innerText: null,
            inputType: null,
        })
    }

    /** A sessão da página gravada, filtrada pela origem dela. */
    private async captureStorageState(): Promise<StorageState | null> {
        if (!this.context || !this.page) return null

        try {
            const full = await this.context.storageState()
            const url = new URL(this.page.url())
            const hostname = url.hostname

            return {
                cookies: full.cookies.filter((cookie) => {
                    const domain = cookie.domain.replace(/^\./, '')
                    return hostname === domain || hostname.endsWith(`.${domain}`)
                }),
                origins: full.origins.filter((origin) => origin.origin === url.origin),
            }
        } catch {
            return null
        }
    }

    /** A URL do CDP com o hostname resolvido em IP, que é o que o DevTools do Chrome aceita. */
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
