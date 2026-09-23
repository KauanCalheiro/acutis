import { homedir } from 'node:os'
import { acutis } from '@acutis/core/common/utils/acutis.js'
import { readAppConfig } from '@acutis/core/config/env.js'
import { installId } from '@acutis/core/modules/telemetry/install-id.js'
import { TelemetryService } from '@acutis/core/modules/telemetry/telemetry.service.js'
import { version } from '../../../package.json'

const alreadySent = new Set<string>()

export function telemetryReporter(): TelemetryService {
  const { telemetry } = readAppConfig(process.env)

  return new TelemetryService({
    url: telemetry.url,
    key: telemetry.key,
    consent: telemetry.consent,
    root: acutis().root,
    home: homedir(),
    version,
    env: process.env
  }, fetch, installId, alreadySent)
}

export interface CapturedErrorContext {
  event?: unknown
  tags?: string[]
}

/** Envia o erro que o Nitro capturou fora de uma requisição; o da requisição a tela já envia. */
export async function captureUnhandledError(error: unknown, context: CapturedErrorContext): Promise<void> {
  if (context.event !== undefined) return

  await telemetryReporter().report({
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
    context: context.tags?.join(',')
  })
}
