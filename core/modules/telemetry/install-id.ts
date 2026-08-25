import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** O identificador anônimo da instalação, criado na primeira leitura e reusado depois. */
export function installId(root: string): string {
  const file = join(root, 'runtime/install-id')

  try {
    const saved = readFileSync(file, 'utf8').trim()
    if (saved !== '') return saved
  } catch {
    // primeiro uso
  }

  const created = randomUUID()
  mkdirSync(join(root, 'runtime'), { recursive: true })
  writeFileSync(file, created)

  return created
}
