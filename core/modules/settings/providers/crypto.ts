/** A cifra dos valores sensíveis do banco de configurações. */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { databasePath } from '../../../config/database.js'
import { APP_CONFIG } from '../../../config/env.js'

/** Se a chave serve para o AES-256: 32 bytes em hexadecimal. */
function isUsable(key: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(key)
}

/** A chave de cifra, gerada na primeira execução e guardada ao lado do banco. */
function encryptionKey(): Buffer {
  const fromEnvironment = APP_CONFIG.appKey

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
