import { installId } from './install-id.js'
import { redact } from './redact.js'

const TIMEOUT_MS = 3_000

export interface TelemetryConfig {
  url: string
  key: string
  root: string
  home: string
  version?: string
  env?: Record<string, string | undefined>
}

export interface ErrorReport {
  message: string
  stack?: string
  context?: string
}

/** Manda para a API de telemetria o relato que a pessoa escolheu enviar. */
export class TelemetryService {
  constructor(
    private readonly config: TelemetryConfig,
    private readonly send: typeof fetch = fetch,
    private readonly identify: (root: string) => string = installId
  ) {}

  async report(report: ErrorReport): Promise<boolean> {
    if (this.config.url === '') return false

    const context = { home: this.config.home, env: this.config.env }
    const body = JSON.stringify({
      message: redact(report.message, context),
      stack: redact(report.stack, context),
      context: redact(report.context, context),
      cliVersion: this.config.version ?? 'desconhecida',
      nodeVersion: process.version,
      platform: process.platform,
      installId: this.identify(this.config.root)
    })

    try {
      const response = await this.send(this.config.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${this.config.key}` },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })

      return response.ok
    } catch {
      return false
    }
  }
}
