/**
 * Um cenário do projeto: o par `tests/<id>.spec.ts` + `features/<id>.feature`. O id é o caminho do
 * spec sem `tests/` e sem a extensão.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'
import { NotFound } from '../../../common/exceptions/errors.js'
import { AUTH_FEATURE, AUTH_ID, AUTH_SPEC } from '../../auth/providers/auth.js'

const AUTH_TITLE = 'Autenticação'

/** O código do spec com o import do wrapper do runner de volta ao do Playwright. */
const RUNNER_WRAPPER_IMPORT = /(from\s+['"])(?:\.\.?\/)+acutis-run(['"])/g

export interface ScenarioData {
    title: string
    spec: string
    feature: string | null
    tags: string[]
    /** A subpasta dentro de `tests/`, quando existe. */
    domain: string | null
}

export function idFor(spec: string): string {
    return spec.replace(/^tests\//, '').replace(/\.(spec|setup)\.ts$/, '')
}

export function eventsPathOf(spec: string): string {
    return spec.replace(/\.(spec|setup)\.ts$/, '.events.json')
}

export function htmlPathOf(spec: string): string {
    return spec.replace(/\.(spec|setup)\.ts$/, '.dom.json')
}

export function sourceOf(file: string): string {
    return readFileSync(file, 'utf8').replace(RUNNER_WRAPPER_IMPORT, "$1@playwright/test$2")
}

function featureTitle(gherkin: string, fallback: string): string {
    const match = gherkin.match(/Funcionalidade:\s*(.+)/u)

    return match ? match[1]!.trim() : fallback
}

function titleOf(featureFile: string, source: string, fallback: string): string {
    if (existsSync(featureFile)) {
        const match = readFileSync(featureFile, 'utf8').match(/Funcionalidade:\s*(.+)/u)

        if (match) return match[1]!.trim()
    }

    const describe = source.match(/test\.describe\(\s*['"](.+?)['"]/u)

    return describe ? describe[1]! : fallback
}

function tagsOf(source: string): string[] {
    const list = source.match(/tag:\s*\[([^\]]*)\]/)

    return list ? (list[1]!.match(/@[\w-]+/g) ?? []) : []
}

/** Todos os cenários do projeto, incluindo os que moram em subpasta de `tests/`. */
export function listScenarios(projectPath: string): ScenarioData[] {
    const testsDir = join(projectPath, 'tests')

    if (!existsSync(testsDir)) return []

    const specs = readdirSync(testsDir, { withFileTypes: true, recursive: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.ts'))
        .map((entry) => join(entry.parentPath ?? testsDir, entry.name))
        // Só um nível de subpasta.
        .filter((spec) => relative(testsDir, dirname(spec)).split('/').filter(Boolean).length <= 1)
        .sort()

    return specs.map((spec) => {
        const relativeDir = relative(testsDir, dirname(spec))
        const domain = relativeDir === '' ? null : relativeDir
        const name = basename(spec, '.spec.ts')
        const specRelative = domain === null ? `${name}.spec.ts` : `${domain}/${name}.spec.ts`
        const featureRelative = domain === null ? `${name}.feature` : `${domain}/${name}.feature`
        const featureFile = join(projectPath, 'features', featureRelative)

        return {
            title: titleOf(featureFile, readFileSync(spec, 'utf8'), name),
            spec: `tests/${specRelative}`,
            feature: existsSync(featureFile) ? `features/${featureRelative}` : null,
            tags: tagsOf(readFileSync(spec, 'utf8')),
            domain
        }
    })
}

export class Scenario {
    private constructor(private readonly projectPath: string, readonly id: string) {}

    static make(projectPath: string, id: string): Scenario {
        return new Scenario(projectPath, id)
    }

    static fromSpec(projectPath: string, spec: string): Scenario {
        return new Scenario(projectPath, idFor(spec))
    }

    isAuth(): boolean {
        return this.id === AUTH_ID
    }

    /** O caminho do spec relativo ao projeto; 404 quando o cenário não existe. */
    spec(): string {
        if (!this.isAuth()) return this.data().spec

        if (!existsSync(join(this.projectPath, AUTH_SPEC))) {
            throw new NotFound('Autenticação não configurada.')
        }

        return AUTH_SPEC
    }

    file(): string {
        return join(this.projectPath, this.spec())
    }

    source(): string {
        return sourceOf(this.file())
    }

    eventsFile(): string {
        return join(this.projectPath, eventsPathOf(this.spec()))
    }

    /** Os eventos que originaram o cenário, quando a gravação foi guardada. */
    events(): unknown[] {
        const file = this.eventsFile()

        if (!existsSync(file)) return []

        try {
            return JSON.parse(readFileSync(file, 'utf8')) as unknown[]
        } catch {
            return []
        }
    }

    data(): ScenarioData {
        if (this.isAuth()) return this.authData()

        const specRelative = `tests/${this.id}.spec.ts`
        const found = listScenarios(this.projectPath).find((candidate) => candidate.spec === specRelative)

        if (!found) throw new NotFound('Cenário não encontrado.')

        return found
    }

    private authData(): ScenarioData {
        const feature = join(this.projectPath, AUTH_FEATURE)
        const written = existsSync(feature)

        return {
            title: written ? featureTitle(readFileSync(feature, 'utf8'), AUTH_TITLE) : AUTH_TITLE,
            spec: AUTH_SPEC,
            feature: written ? AUTH_FEATURE : null,
            tags: [],
            domain: null
        }
    }
}
