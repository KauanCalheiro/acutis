/** A escrita em disco do repositório de arquivos: o diretório nasce junto com o arquivo. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

export function put(file: string, contents: string): void {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, contents)
}
