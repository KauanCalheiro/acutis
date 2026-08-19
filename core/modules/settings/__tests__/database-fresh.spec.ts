// @vitest-environment node
/** O `db:fresh`: joga fora o banco de desenvolvimento e o refaz pelas migrations. */
import { existsSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DataSource } from 'typeorm'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { databaseOptions, databasePath } from '../../../config/database.js'
import { fresh } from '../../../config/database-fresh.js'

let previousRoot: string | undefined
let root: string

beforeEach(() => {
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  root = mkdtempSync(join(tmpdir(), 'acutis-fresh-'))
  process.env.ACUTIS_PROJECTS_PATH = root
})

afterEach(() => {
  if (previousRoot === undefined) {
    delete process.env.ACUTIS_PROJECTS_PATH
  } else {
    process.env.ACUTIS_PROJECTS_PATH = previousRoot
  }
})

/** O banco de pé, para inspecionar o que sobrou. */
async function connect(): Promise<DataSource> {
  return new DataSource({ ...databaseOptions(), migrationsRun: false }).initialize()
}

it('cria o banco do zero quando ainda não existe nenhum', async () => {
  expect(existsSync(databasePath())).toBe(false)

  await fresh()

  const source = await connect()
  const rows = await source.query('SELECT name FROM sqlite_master WHERE type = \'table\'') as { name: string }[]

  await source.destroy()

  expect(rows.map(row => row.name)).toEqual(expect.arrayContaining(['settings', 'ai_settings', 'migrations']))
})

it('leva junto o que estava gravado antes', async () => {
  await fresh()

  const antes = await connect()

  await antes.query('INSERT INTO settings (key, value) VALUES (\'ai.provider\', \'cifrado\')')
  await antes.destroy()

  await fresh()

  const depois = await connect()
  const rows = await depois.query('SELECT key FROM settings') as unknown[]

  await depois.destroy()

  expect(rows).toHaveLength(0)
})
