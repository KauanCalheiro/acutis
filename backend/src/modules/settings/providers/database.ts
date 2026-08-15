/** O único banco do acutis: duas tabelas de configuração, em SQL direto sobre o `better-sqlite3`. */
import Database from 'better-sqlite3'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { acutis } from '../../../common/utils/acutis.js'
import { PROVIDER_NAMES } from './ai-providers.js'

/**
 * O esquema das duas tabelas.
 *
 * ponytail: schema inline; vira arquivo .sql quando houver passo de assets no build.
 */
const SCHEMA = `
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
    );

    CREATE TABLE IF NOT EXISTS ai_settings (
        provider TEXT PRIMARY KEY,
        key TEXT,
        url TEXT,
        model TEXT
    );
`

/** Converte o cadastro de dois modelos (barato e esperto) no de um só, preferindo o esperto. */
function migrateToSingleModel(database: Database.Database): void {
    const columns = database.prepare('PRAGMA table_info(ai_settings)').all() as { name: string }[]
    const names = columns.map((column) => column.name)

    if (!names.includes('model_cheapest')) return

    database.exec('ALTER TABLE ai_settings ADD COLUMN model TEXT')
    database.exec('UPDATE ai_settings SET model = COALESCE(model_smartest, model_cheapest)')
    database.exec('ALTER TABLE ai_settings DROP COLUMN model_cheapest')
    database.exec('ALTER TABLE ai_settings DROP COLUMN model_smartest')
}

/** Uma conexão por caminho de banco. */
const connections = new Map<string, Database.Database>()

export function databasePath(): string {
    return join(acutis().root, 'runtime/database.sqlite')
}

/** Cria a linha vazia de cada provedor conhecido. */
function seedProviders(connection: Database.Database): void {
    const insert = connection.prepare('INSERT OR IGNORE INTO ai_settings (provider) VALUES (?)')

    for (const provider of PROVIDER_NAMES) insert.run(provider)
}

export function db(): Database.Database {
    const path = databasePath()
    const open = connections.get(path)

    if (open) return open

    mkdirSync(dirname(path), { recursive: true })

    const connection = new Database(path)

    connection.exec(SCHEMA)
    migrateToSingleModel(connection)
    seedProviders(connection)
    connections.set(path, connection)

    return connection
}

/** Se a chave serve para o AES-256: 32 bytes em hexadecimal. */
function isUsable(key: string): boolean {
    return /^[0-9a-fA-F]{64}$/.test(key)
}

/** A chave de cifra, gerada na primeira execução e guardada ao lado do banco. */
function encryptionKey(): Buffer {
    const fromEnvironment = process.env.ACUTIS_APP_KEY

    if (fromEnvironment && isUsable(fromEnvironment)) return Buffer.from(fromEnvironment, 'hex')

    const file = join(dirname(databasePath()), 'app-key')

    if (!existsSync(file) || !isUsable(readFileSync(file, 'utf8').trim())) {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 })
    }

    return Buffer.from(readFileSync(file, 'utf8').trim(), 'hex')
}

/** O valor cifrado em AES-256-GCM, com o vetor e a etiqueta embutidos. */
export function encrypt(value: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
    const sealed = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])

    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64')
}

/** O valor decifrado, ou null quando ele não decifra. */
export function decrypt(value: string | null): string | null {
    if (value === null) return null

    try {
        const raw = Buffer.from(value, 'base64')
        const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), raw.subarray(0, 12))

        decipher.setAuthTag(raw.subarray(12, 28))

        return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8')
    } catch {
        return null
    }
}
