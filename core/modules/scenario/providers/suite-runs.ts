/** O histórico das execuções agrupadas do projeto: um arquivo ndjson, uma linha por rodada. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { SuiteRun } from '#shared/contracts/report'

export const SUITE = '_suite'
export const HISTORY = 'history.ndjson'

/** Quantas rodadas ficam guardadas. */
export const KEPT = 50

export class SuiteRuns {
  constructor(private readonly projectPath: string) {}

  directory(): string {
    return join(this.projectPath, 'runs', SUITE)
  }

  file(): string {
    return join(this.directory(), HISTORY)
  }

  private lines(): string[] {
    if (!existsSync(this.file())) return []

    return readFileSync(this.file(), 'utf8')
      .split('\n')
      .filter(line => line.trim() !== '')
  }

  /** Da mais recente para a mais antiga, pela data que cada linha diz ter. */
  all(): SuiteRun[] {
    return this.lines()
      .map((line) => {
        try {
          return JSON.parse(line) as SuiteRun
        } catch {
          return null
        }
      })
      .filter((run): run is SuiteRun => run !== null)
      .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))
  }

  append(run: SuiteRun): void {
    mkdirSync(this.directory(), { recursive: true })
    appendFileSync(this.file(), `${JSON.stringify(run)}\n`)

    const lines = this.lines()

    if (lines.length > KEPT) {
      writeFileSync(this.file(), `${lines.slice(-KEPT).join('\n')}\n`)
    }
  }
}
