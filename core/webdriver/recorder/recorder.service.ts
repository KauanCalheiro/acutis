import { randomUUID } from 'node:crypto'
import { lookup } from 'node:dns/promises'
import { existsSync } from 'node:fs'
import { isIP } from 'node:net'
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright'
import { RECORDER_CDP_URL, RECORDER_HEADLESS } from '../../config/env.js'
import { RECORDER_BUNDLE_PATH } from '../../config/paths.js'
import type { VideoService } from '../video/video.service.js'
import type { RecordingEvent } from '../../common/types/recording.js'
import { replaySteps, type ReplayState, type ReplayStep } from './replay.js'

export interface StorageState {
  cookies: unknown[]
  origins: unknown[]
}

export interface StopResult {
  sessionId: string | null
  storageState: StorageState | null
}

/** O que a retomada avisa enquanto refaz os passos gravados. */
export interface ReplayHooks {
  /** Os passos acabaram (ou o usuário assumiu no meio): daqui para frente a gravação é dele. */
  onReplayed?: (keptEvents: number | null) => void | Promise<void>
  /** Um passo não repetiu nem na segunda tentativa; a decisão está com o usuário, na janela. */
  onFailed?: (step: string) => void
  /** Ele preferiu cancelar a retomada em vez de assumir a partir de onde travou. */
  onCancelled?: (step: string) => void | Promise<void>
  /** O botão de cancelar da pill: descartar a gravação em vez de encerrar com revisão. */
  onCancelRequested?: () => void | Promise<void>
}

const RECORDING_VIEWPORT = { width: 1280, height: 720 }
const STORAGE_STATE_TIMEOUT_MS = 1500
const SCREENCAST_STOP_TIMEOUT_MS = 2500
const CDP_CLOSE_TIMEOUT_MS = 1500
const REPLAY_STEP_TIMEOUT_MS = 2500
const REPLAY_RETRY_TIMEOUT_MS = 4000
const REPLAY_SETTLE_MS = 1500
const DECISION_POLL_MS = 200

const BLANK = 'about:blank'

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
  private replaying = false
  private replayState: ReplayState = { status: 'idle', step: null }
  private replayDecision: 'resume' | 'cancel' | null = null
  private bundlePath: string | null = null
  private bundleLoader: (() => Promise<string>) | null = null
  private stopping = false

  constructor(private readonly videoService: VideoService) { }

  configureBundlePath(path: string): void {
    this.bundlePath = path
  }

  configureBundleLoader(loader: () => Promise<string>): void {
    this.bundleLoader = loader
  }

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
    replay?: RecordingEvent[],
    hooks: ReplayHooks = {}
  ): Promise<void> {
    this.sessionId = randomUUID()
    this.screencastStarted = false
    this.ready = false
    this.replaying = false
    this.stopping = false
    await this.videoService.ensureDir()

    if (RECORDER_CDP_URL) {
      try {
        this.browser = await chromium.connectOverCDP(await this.resolveCdpUrl(RECORDER_CDP_URL))
      } catch {
        throw new Error(
          `Não foi possível conectar ao Chrome em ${RECORDER_CDP_URL}. `
          + 'Abra o Chrome do host com --remote-debugging-port=9222 e um --user-data-dir dedicado.'
        )
      }
      this.overCdp = true
      // Modo CDP grava no contexto do Chrome do usuário, com a sessão real dele.
      this.context = this.browser.contexts()[0] ?? await this.browser.newContext()
    } else {
      if (storageStatePath && !existsSync(storageStatePath)) {
        throw new Error(
          `Sessão não encontrada em ${storageStatePath}. `
          + 'Rode o setup de autenticação do projeto antes de gravar um cenário autenticado.'
        )
      }

      this.browser = await chromium.launch({ headless: RECORDER_HEADLESS })
      this.overCdp = false
      this.context = await this.browser.newContext(
        storageStatePath ? { storageState: storageStatePath } : {}
      )
    }
    this.page = await this.context.newPage()
    await this.page.setViewportSize(RECORDING_VIEWPORT)

    // about:blank aparece ao abrir e ao fechar a janela, e não é passo de teste nenhum.
    this.lastUrl = null
    this.report = (event: RecordingEvent) => {
      if (this.replaying) return

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
    await this.page.exposeFunction('__acutisCancelRecording', () => hooks.onCancelRequested?.())
    await this.page.exposeFunction('__acutisReplayState', () => this.replayState)
    await this.page.exposeFunction('__acutisReplayDecision', (decision: string) => {
      this.decideReplay(decision === 'resume' ? 'resume' : 'cancel')
    })

    await this.context.addInitScript((recorderMode) => {
      (globalThis as unknown as { __acutisRecorderMode?: string }).__acutisRecorderMode = recorderMode
    }, mode)
    if (this.bundleLoader) {
      await this.context.addInitScript({ content: await this.bundleLoader() })
    } else {
      await this.context.addInitScript({ path: this.bundlePath ?? RECORDER_BUNDLE_PATH })
    }

    this.ready = true

    this.page.on('close', () => this.handleExternalClose(onRequestStop, hooks))
    this.browser.on('disconnected', () => this.handleExternalClose(onRequestStop, hooks))

    const sessionId = this.sessionId
    const videoPath = this.videoService.path(sessionId)

    this.page.on('framenavigated', (frame) => {
      if (!this.page || frame !== this.page.mainFrame() || this.screencastStarted) return
      if (frame.url() === BLANK) return
      this.screencastStarted = true
      const recordingStartedAt = Date.now()
      void this.page.screencast.start({ path: videoPath, size: RECORDING_VIEWPORT }).then(() => onStarted(recordingStartedAt))
    })

    const steps = replay?.length ? replaySteps(replay) : []

    if (steps.length) this.replayState = { status: 'running', step: steps[0]!.label }

    if (url && !steps.some(step => step.action === 'goto')) {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' })
        .catch(() => { /* site fora do ar: o usuário navega à mão */ })
    }

    if (!steps.length) return

    const { cancelledAt, keptEvents } = await this.replay(steps, hooks)

    if (cancelledAt !== null) {
      await hooks.onCancelled?.(cancelledAt)
      return
    }

    await hooks.onReplayed?.(keptEvents)
  }

  /**
     * Refaz os passos já gravados para o usuário continuar do ponto que escolheu. Passo que não
     * repete nem na segunda tentativa para a retomada e devolve a decisão para ele, na janela.
     * Devolve o passo em que ele cancelou e, quando assumiu no meio, quantos eventos foram refeitos.
     */
  private async replay(
    steps: ReplayStep[],
    hooks: ReplayHooks
  ): Promise<{ cancelledAt: string | null, keptEvents: number | null }> {
    if (!this.page) return { cancelledAt: null, keptEvents: null }

    const page = this.page
    this.replaying = true
    this.replayState = { status: 'running', step: steps[0]!.label }

    let keptEvents: number | null = null

    try {
      for (const step of steps) {
        this.replayState = { status: 'running', step: step.label }

        if (await this.attempt(page, step, REPLAY_STEP_TIMEOUT_MS)) continue
        if (await this.attempt(page, step, REPLAY_RETRY_TIMEOUT_MS)) continue

        this.replayState = { status: 'failed', step: step.label }
        hooks.onFailed?.(step.label)

        const decision = await this.awaitDecision(page)

        if (decision === 'cancel') return { cancelledAt: step.label, keptEvents: null }
        if (decision === null) return { cancelledAt: null, keptEvents: null }

        keptEvents = step.at
        break
      }

      await page.waitForTimeout(REPLAY_SETTLE_MS)

      return { cancelledAt: null, keptEvents }
    } finally {
      this.replaying = false
      this.replayState = { status: 'idle', step: null }
      this.lastUrl = page.url()
    }
  }

  /** Um passo refeito. O clique é despachado no elemento, porque a cortina cobre a página. */
  private async attempt(page: Page, step: ReplayStep, timeout: number): Promise<boolean> {
    try {
      if (step.action === 'goto') {
        await page.goto(step.url, { waitUntil: 'domcontentloaded' })
      } else if (step.action === 'fill') {
        await page.fill(step.selector, step.value, { timeout, force: true })
        await page.locator(step.selector).blur({ timeout }).catch(() => undefined)
      } else {
        await page.locator(step.selector).dispatchEvent('click', {}, { timeout })
      }

      return true
    } catch {
      return false
    }
  }

  /** A escolha que o usuário faz na cortina, ou null quando a janela some antes de ele escolher. */
  private async awaitDecision(page: Page): Promise<'resume' | 'cancel' | null> {
    this.replayDecision = null

    while (this.replayDecision === null) {
      if (page.isClosed() || this.stopping) return null
      await new Promise(resolve => setTimeout(resolve, DECISION_POLL_MS))
    }

    return this.replayDecision
  }

  /** A janela fechada pelo usuário descarta a gravação, pelo mesmo caminho do cancelar da pill. */
  private handleExternalClose(onRequestStop: () => void, hooks: ReplayHooks): void {
    if (this.stopping || !this.context) return

    const discard = hooks.onCancelRequested

    if (!discard) {
      onRequestStop()
      return
    }

    Promise.resolve(discard()).catch(() => undefined)
  }

  async stop(): Promise<StopResult> {
    if (!this.context) {
      return { sessionId: null, storageState: null }
    }

    this.stopping = true
    const sessionId = this.sessionId
    const wasScreencasting = this.screencastStarted
    const storageState = await this.withTimeout(
      this.captureStorageState(),
      STORAGE_STATE_TIMEOUT_MS,
      null
    )

    this.reportFinalUrl()

    if (wasScreencasting && this.page) {
      try {
        await this.withTimeout(
          this.page.screencast.stop().catch(() => undefined),
          SCREENCAST_STOP_TIMEOUT_MS,
          undefined
        )
      } catch { /* já parado */ }
    }

    if (this.overCdp) {
      try {
        await this.withTimeout(
          this.page?.close() ?? Promise.resolve(),
          CDP_CLOSE_TIMEOUT_MS,
          undefined
        )
      } catch { /* já fechada */ }
      try {
        await this.withTimeout(
          this.browser?.close() ?? Promise.resolve(),
          CDP_CLOSE_TIMEOUT_MS,
          undefined
        )
      } catch { /* só desconecta do Chrome do host */ }
    } else {
      try {
        await this.context.close()
      } catch { /* processo ou navegador já encerrou */ }
      try {
        await this.browser?.close()
      } catch { /* já fechado */ }
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
      inputType: null
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
        origins: full.origins.filter(origin => origin.origin === url.origin)
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
      await new Promise(r => setTimeout(r, 50))
    }
    return this.page
  }

  /** A mesma decisão que a cortina manda; o shadow fechado dela não é alcançável de fora. */
  decideReplay(decision: 'resume' | 'cancel'): void {
    this.replayDecision = decision
  }

  async debugGoto(url: string): Promise<void> {
    const page = await this.waitForPage()
    await page.goto(url, { waitUntil: 'domcontentloaded' })
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

  /** Fecha a página gravada como se o usuário tivesse fechado a janela na mão. */
  async debugClosePage(): Promise<void> {
    const page = await this.waitForPage()
    await page.close()
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallback: T): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeout = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(fallback), timeoutMs)
    })

    try {
      return await Promise.race([promise, timeout])
    } finally {
      clearTimeout(timer)
    }
  }
}
