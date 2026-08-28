/**
 * O `.gitattributes` do projeto, escrito por acréscimo e nunca por substituição. Ele é versionado,
 * então vale para todo mundo que clonar, sem depender da configuração de cada máquina.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ENTRIES = [
  '* text=auto eol=lf',
  // O histórico de execução só cresce no fim: as linhas dos dois lados cabem juntas.
  'runs/**/history.ndjson merge=union',
  '*.webm binary'
]

function file(projectPath: string): string {
  return join(projectPath, '.gitattributes')
}

export function ensureGitattributes(projectPath: string): void {
  const target = file(projectPath)
  const existing = existsSync(target) ? readFileSync(target, 'utf8') : ''
  const missing = ENTRIES.filter(entry => !existing.includes(entry))

  if (missing.length === 0) return

  writeFileSync(target, `${`${existing}\n${missing.join('\n')}`.replace(/\n+$/, '')}\n`)
}
