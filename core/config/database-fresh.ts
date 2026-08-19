/** Refaz o banco do zero pelas migrations. Só para desenvolvimento: o que estava gravado se perde. */
import { rmSync } from 'node:fs'
import { DataSource } from 'typeorm'
import { databaseOptions, databasePath } from './database.js'

export async function fresh(): Promise<string> {
  const path = databasePath()

  rmSync(path, { force: true })

  const source = new DataSource(databaseOptions())

  await source.initialize()
  await source.destroy()

  return path
}
