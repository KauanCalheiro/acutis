// @vitest-environment node
/** O banco das configurações, criado e evoluído pelas migrations do TypeORM. */
import { DataSource } from 'typeorm'
import { afterEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { SettingsModule } from '../settings.module.js'

let api: Harness

afterEach(async () => {
    await api?.close()
})

/** As tabelas que existem no banco daquele app. */
async function tables(source: DataSource): Promise<string[]> {
    const rows = await source.query("SELECT name FROM sqlite_master WHERE type = 'table'") as { name: string }[]

    return rows.map((row) => row.name)
}

it('cria as tabelas de configuração ao subir', async () => {
    api = await startApi([SettingsModule])

    expect(await tables(api.get<DataSource>(DataSource))).toEqual(expect.arrayContaining(['settings', 'ai_settings']))
})

it('guarda no próprio banco quais migrations já rodaram', async () => {
    api = await startApi([SettingsModule])

    const source = api.get<DataSource>(DataSource)
    const executed = await source.query('SELECT name FROM migrations ORDER BY id') as { name: string }[]

    expect(executed.length).toBeGreaterThan(0)
    expect(await source.showMigrations()).toBe(false)
})

it('não repete uma migration num banco que já subiu antes', async () => {
    api = await startApi([SettingsModule])

    const source = api.get<DataSource>(DataSource)
    const antes = await source.query('SELECT name FROM migrations') as unknown[]

    await source.runMigrations()

    expect(await source.query('SELECT name FROM migrations') as unknown[]).toHaveLength(antes.length)
})

it('cria o cadastro de ia com as colunas que a tela usa', async () => {
    api = await startApi([SettingsModule])

    const source = api.get<DataSource>(DataSource)
    const columns = await source.query('PRAGMA table_info(ai_settings)') as { name: string }[]

    expect(columns.map((column) => column.name)).toEqual(['provider', 'key', 'url', 'model'])
})
