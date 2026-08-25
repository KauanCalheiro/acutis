import { homedir } from 'node:os'
import { acutis } from '@acutis/core/common/utils/acutis.js'
import { readAppConfig } from '@acutis/core/config/env.js'
import { TelemetryService } from '@acutis/core/modules/telemetry/telemetry.service.js'
import { version } from '../../../package.json'

export function telemetryReporter(): TelemetryService {
  const { telemetry } = readAppConfig(process.env)

  return new TelemetryService({
    url: telemetry.url,
    key: telemetry.key,
    root: acutis().root,
    home: homedir(),
    version,
    env: process.env
  })
}
