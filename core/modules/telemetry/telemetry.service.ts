import { release } from 'node:os'
import { installId } from './install-id.js'
import { redact } from './redact.js'

const TIMEOUT_MS = 3_000

export interface TelemetryConfig {
  url: string
  key: string
  root: string
  home: string
  consent: boolean
  version?: string
  env?: Record<string, string | undefined>
}

export interface ErrorReport {
  message: string
  stack?: string
  context?: string
  details?: Record<string, unknown>
  secrets?: string[]
}

function originWithDetails(context: string | undefined, details: Record<string, unknown> | undefined): string | undefined {
  if (details === undefined) return context

  return `${context ?? ''}\n${JSON.stringify(details, null, 2)}`
}

/** Manda para a API de telemetria os erros de quem consentiu, uma vez cada. */
export class TelemetryService {
  constructor(
    private readonly config: TelemetryConfig,
    private readonly send: typeof fetch = fetch,
    private readonly identify: (root: string) => string = installId,
    private readonly alreadySent: Set<string> = new Set()
  ) {}

  async report(report: ErrorReport): Promise<boolean> {
    if (this.config.url === '' || !this.config.consent) return false

    const context = { home: this.config.home, env: this.config.env, secrets: report.secrets }
    const message = redact(report.message, context)
    const stack = redact(report.stack, context)
    const origin = redact(originWithDetails(report.context, report.details), context)
    const fingerprint = JSON.stringify([message, stack, origin])

    if (this.alreadySent.has(fingerprint)) return false

    const body = JSON.stringify({
      message,
      stack,
      context: origin,
      cliVersion: this.config.version ?? 'desconhecida',
      nodeVersion: process.version,
      platform: `${process.platform} ${process.arch} ${release()}`,
      installId: this.identify(this.config.root)
    })

    try {
      const response = await this.send(this.config.url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${this.config.key}` },
        body,
        signal: AbortSignal.timeout(TIMEOUT_MS)
      })

      if (response.ok) this.alreadySent.add(fingerprint)

      return response.ok
    } catch {
      return false
    }
  }
}
