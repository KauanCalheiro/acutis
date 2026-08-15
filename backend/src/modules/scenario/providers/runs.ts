/** O histórico de execuções de um cenário: um arquivo ndjson, uma linha por execução. */
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RunStep } from '../dto/responses/scenario.response.js'

export const VIDEO = 'last.webm'
export const HISTORY = 'history.ndjson'

/** Quantas execuções ficam guardadas. Além disto, o histórico vira arquivo de log sem leitor. */
export const KEPT = 20

/** Uma linha do histórico; o que vier de uma versão anterior pode não ter todos os campos. */
export interface Run {
    started_at: string
    duration_ms: number
    passed: boolean
    branch?: string | null
    author?: string | null
    steps?: RunStep[]
    playwright?: string
    video?: boolean
}

export class Runs {
    constructor(private readonly projectPath: string, private readonly scenarioId: string) {}

    directory(): string {
        return join(this.projectPath, 'runs', this.scenarioId)
    }

    file(): string {
        return join(this.directory(), HISTORY)
    }

    video(): string {
        return join(this.directory(), VIDEO)
    }

    private lines(): string[] {
        if (!existsSync(this.file())) return []

        return readFileSync(this.file(), 'utf8')
            .split('\n')
            .filter((line) => line.trim() !== '')
    }

    /** Da mais recente para a mais antiga, que é a ordem em que a tela as mostra. */
    all(): Run[] {
        return this.lines()
            .reverse()
            .map((line) => {
                try {
                    return JSON.parse(line) as Run
                } catch {
                    return null
                }
            })
            .filter((run): run is Run => run !== null)
    }

    lastPassed(): boolean | null {
        return this.all()[0]?.passed ?? null
    }

    append(run: Run): void {
        mkdirSync(this.directory(), { recursive: true })
        appendFileSync(this.file(), `${JSON.stringify(run)}\n`)

        const lines = this.lines()

        if (lines.length > KEPT) {
            writeFileSync(this.file(), `${lines.slice(-KEPT).join('\n')}\n`)
        }
    }
}
