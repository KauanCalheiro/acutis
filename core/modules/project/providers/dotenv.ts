/**
 * O `.env` do projeto e o `.env.example` que o acompanha: o primeiro guarda os valores e não é
 * versionado, o segundo guarda só as chaves e é.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EnvKey } from '../../environment/providers/env-key.js'
import { fromLine } from '../../environment/providers/environment-var.js'
import { ensureGitignore } from './gitignore.js'

function line(key: string, value: string): string {
  return `${key}=${value}`
}

function parse(file: string): Record<string, string> {
  if (!existsSync(file)) return {}

  const values: Record<string, string> = {}

  for (const raw of readFileSync(file, 'utf8').split('\n')) {
    const variable = fromLine(raw)

    if (variable !== null) values[variable.key] = variable.value ?? ''
  }

  return values
}

function lineOf(lines: string[], key: string): number | null {
  const index = lines.findIndex(raw => fromLine(raw)?.key === key)

  return index === -1 ? null : index
}

function mergeFile(file: string, values: Record<string, string>): void {
  const existing = existsSync(file) ? readFileSync(file, 'utf8') : ''
  const lines = existing === '' ? [] : existing.replace(/\n+$/, '').split('\n')

  for (const [key, value] of Object.entries(values)) {
    const index = lineOf(lines, key)

    if (index !== null) {
      lines[index] = line(key, value)
    } else {
      lines.push(line(key, value))
    }
  }

  writeFileSync(file, `${lines.join('\n')}\n`)
}

function removeFrom(file: string, keys: string[]): void {
  if (!existsSync(file)) return

  const lines = readFileSync(file, 'utf8')
    .replace(/\n+$/, '')
    .split('\n')
    .filter((raw) => {
      const key = fromLine(raw)?.key

      return key === undefined || !keys.includes(key)
    })

  writeFileSync(file, lines.length === 0 ? '' : `${lines.join('\n')}\n`)
}

export class Dotenv {
  constructor(private readonly path: string) {}

  private file(): string {
    return join(this.path, '.env')
  }

  private example(): string {
    return join(this.path, '.env.example')
  }

  get(key: string, fallback: string | null = null): string | null {
    return this.all()[key] ?? fallback
  }

  set(key: string, value: string): void {
    this.merge({ [key]: value })
  }

  all(): Record<string, string> {
    return parse(this.file())
  }

  exampleKeys(): string[] {
    return Object.keys(parse(this.example()))
  }

  remove(keys: string[]): void {
    removeFrom(this.file(), keys)
    removeFrom(this.example(), keys)
  }

  /**
     * As chaves que o projeto espera, anunciadas no exemplo sem valor nenhum. Quem clona não recebe
     * `environments/`, então é por aqui que ele descobre o que precisa preencher.
     */
  announce(keys: string[]): void {
    const declared = keys.filter(key => key !== EnvKey.ACTIVE_ENVIRONMENT)

    if (declared.length === 0) return

    mergeFile(this.example(), Object.fromEntries(declared.map(key => [key, ''])))
    ensureGitignore(this.path)
  }

  merge(values: Record<string, string>): void {
    mergeFile(this.file(), values)

    // O exemplo leva as chaves sem os valores, e sem o ambiente ativo, que é estado local.
    const exampleKeys = Object.keys(values).filter(key => key !== EnvKey.ACTIVE_ENVIRONMENT)
    mergeFile(this.example(), Object.fromEntries(exampleKeys.map(key => [key, ''])))

    ensureGitignore(this.path)
  }
}
