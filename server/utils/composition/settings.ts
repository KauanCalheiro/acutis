import { databaseOptions, databasePath } from '@acutis/core/config/database.js'
import { AiCredentialSchema } from '@acutis/core/modules/settings/entities/ai-credential.entity.js'
import { SettingSchema } from '@acutis/core/modules/settings/entities/setting.entity.js'
import { SettingsService } from '@acutis/core/modules/settings/settings.service.js'
import { DataSource } from 'typeorm'

let source: DataSource | null = null
let service: SettingsService | null = null
let initializing: Promise<SettingsService> | null = null
let activePath: string | null = null

export async function settingsUseCases(): Promise<SettingsService> {
  const path = databasePath()

  if (source?.isInitialized && service !== null && activePath === path) return service

  if (initializing !== null && activePath === path) return initializing

  initializing = (async () => {
    await closeSettings()
    activePath = path
    source = await new DataSource(databaseOptions()).initialize()
    service = new SettingsService(
      source.getRepository(SettingSchema),
      source.getRepository(AiCredentialSchema)
    )
    await service.onModuleInit()
    return service
  })()

  try {
    return await initializing
  } finally {
    initializing = null
  }
}

export async function closeSettings(): Promise<void> {
  const current = source
  source = null
  service = null
  activePath = null

  if (current?.isInitialized) await current.destroy()
}

export function settingsDataSource(): DataSource | null {
  return source
}
