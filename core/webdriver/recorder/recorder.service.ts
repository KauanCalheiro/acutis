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
  onReplayed?: () => void
  /** Um passo não repetiu nem na segunda tentativa; a decisão está com o usuário, na janela. */
  onFailed?: (step: string) => void
  /** Ele preferiu cancelar a retomada em vez de assumir a partir de onde travou. */
  onCancelled?: (step: string) => void
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
      // O que a reprodução dos passos anteriores provoca na página já está na gravação.
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
    // A cortina da pill pergunta o estado em vez de recebê-lo: cada navegação do replay recarrega a
    // página, e um valor posto no window não sobreviveria a ela.
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

    // Na retomada é o primeiro passo refeito que abre a página; abrir a URL antes disso gravaria
    // essa navegação como passo do usuário.
    if (url && !steps.some(step => step.action === 'goto')) {
      await this.page.goto(url, { waitUntil: 'domcontentloaded' })
        .catch(() => { /* site fora do ar: o usuário navega à mão */ })
    }

    if (!steps.length) return

    const cancelledAt = await this.replay(steps, hooks)

    if (cancelledAt !== null) {
      hooks.onCancelled?.(cancelledAt)
      return
    }

    hooks.onReplayed?.()
  }

  /**
     * Refaz os passos já gravados para o usuário continuar do ponto que escolheu. Passo que não
     * repete nem na segunda tentativa para a retomada e devolve a decisão para ele, na janela: nada
     * é gravado em cima de uma página que ficou no lugar errado. Devolve o passo em que ele
     * cancelou, ou null quando a retomada chegou ao fim.
     */
  private async replay(steps: ReplayStep[], hooks: ReplayHooks): Promise<string | null> {
    if (!this.page) return null

    const page = this.page
    this.replaying = true
    this.replayState = { status: 'running', step: steps[0]!.label }

    try {
      for (const step of steps) {
        this.replayState = { status: 'running', step: step.label }

        if (await this.attempt(page, step, REPLAY_STEP_TIMEOUT_MS)) continue
        // Uma segunda tentativa, mais paciente, cobre o passo que só chegou cedo demais.
        if (await this.attempt(page, step, REPLAY_RETRY_TIMEOUT_MS)) continue

        this.replayState = { status: 'failed', step: step.label }
        hooks.onFailed?.(step.label)

        if (await this.awaitDecision(page) === 'cancel') return step.label

        break
      }

      // O último passo ainda pode disparar navegação de SPA depois de o clique retornar, e ela
      // entraria na gravação como passo do usuário.
      // ponytail: espera fixa; aplicação que demore mais que isso traz o passo fantasma de volta,
      // e aí o caminho é esperar a rede assentar em vez do relógio.
      await page.waitForTimeout(REPLAY_SETTLE_MS)

      return null
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
        await page.locator(step.selector).blur({ timeout })
      } else {
        await page.locator(step.selector).dispatchEvent('click', {}, { timeout })
      }

      return true
    } catch {
      return false
    }
  }

  /** Espera a escolha que o usuário faz na cortina; a janela fechada vale por cancelar. */
  private async awaitDecision(page: Page): Promise<'resume' | 'cancel'> {
    this.replayDecision = null

    while (this.replayDecision === null) {
      if (page.isClosed()) return 'cancel'
      await new Promise(resolve => setTimeout(resolve, DECISION_POLL_MS))
    }

    return this.replayDecision
  }

  async stop(): Promise<StopResult> {
    if (!this.context) {
      return { sessionId: null, storageState: null }
    }

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
