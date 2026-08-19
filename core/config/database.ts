/** A conexão com o banco das configurações e as migrations que o mantêm em dia. */
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { DataSourceOptions } from 'typeorm'
import { acutis } from '../common/utils/acutis.js'
import { CreateSettingsTable1737100000000 } from '../migrations/1737100000000-create-settings-table.js'
import { CreateAiSettingsTable1737100001000 } from '../migrations/1737100001000-create-ai-settings-table.js'
import { AiCredentialSchema } from '../modules/settings/entities/ai-credential.entity.js'
import { SettingSchema } from '../modules/settings/entities/setting.entity.js'

/** O arquivo do banco, derivado da raiz de projetos. */
export function databasePath(): string {
  return join(acutis().root, 'runtime/database.sqlite')
}

/**
 * As migrations entram na lista, e não por glob: o pacote publicado roda o `dist/`, onde caminho de
 * arquivo não sobrevive ao empacotamento.
 */
export function databaseOptions(): DataSourceOptions {
  const database = databasePath()

  mkdirSync(dirname(database), { recursive: true })

  return {
    type: 'better-sqlite3',
    database,
    entities: [SettingSchema, AiCredentialSchema],
    migrations: [CreateSettingsTable1737100000000, CreateAiSettingsTable1737100001000],
    migrationsRun: true,
    synchronize: false
  }
}
