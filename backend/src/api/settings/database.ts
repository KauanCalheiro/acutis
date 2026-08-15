/**
 * O único banco do acutis: duas tabelas de configuração, consultadas direto.
 *
 * O Laravel tinha Eloquent e sete migrations para guardar isto, e o levantamento da migração
 * mostrou que o produto inteiro vive em arquivos — só a configuração de IA precisa de banco. Por
 * isso aqui não há ORM nem camada de repositório: é `better-sqlite3` com SQL escrito à mão.
 */
import Database from 'better-sqlite3'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { acutis } from '../kernel/acutis.js'
import { PROVIDER_NAMES } from './ai-providers.js'

/**
 * As sete migrations viraram isto. Fica como string, e não como `schema.sql` ao lado, porque o
 * build é `tsc` puro: um arquivo não-TS exigiria um passo de cópia para o `dist` só para carregá-lo.
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
        model_cheapest TEXT,
        model_smartest TEXT
    );
`

/**
 * Uma conexão por caminho. O caminho vem da raiz do acutis, que o teste aponta para um diretório
 * temporário — é o que dá a cada teste um banco só dele sem ninguém precisar limpar tabela.
 */
const connections = new Map<string, Database.Database>()

export function databasePath(): string {
    return join(acutis().root, 'runtime/database.sqlite')
}

/**
 * A linha de cada provedor nasce vazia, como a migration fazia: a tela nunca precisa distinguir
 * "provedor sem cadastro" de "provedor com cadastro em branco".
 */
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
    seedProviders(connection)
    connections.set(path, connection)

    return connection
}

/**
 * A chave de cifra, gerada na primeira execução e guardada ao lado do banco.
 *
 * Equivale ao `APP_KEY` do Laravel, e existe pelo mesmo motivo do cast `encrypted`: quem abrir o
 * arquivo do banco não deve encontrar a chave de API em claro.
 */
function encryptionKey(): Buffer {
    const fromEnvironment = process.env.ACUTIS_APP_KEY

    if (fromEnvironment) return Buffer.from(fromEnvironment, 'hex')

    const file = join(dirname(databasePath()), 'app-key')

    if (!existsSync(file)) {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, randomBytes(32).toString('hex'), { mode: 0o600 })
    }

    return Buffer.from(readFileSync(file, 'utf8').trim(), 'hex')
}

/** O texto cifrado guarda consigo o vetor e a etiqueta: uma coluna só, sem esquema extra. */
export function encrypt(value: string): string {
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
    const sealed = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])

    return Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString('base64')
}

/** Null quando o valor não decifra: chave trocada não pode derrubar a tela de configurações. */
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
