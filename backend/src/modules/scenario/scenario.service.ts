/** As operações de cenário: ler, editar, remover e guardar o que cada execução deixou. */
import { Injectable } from '@nestjs/common'
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { Git } from '../git/providers/git.js'
import { ValidationFailed } from '../../common/exceptions/errors.js'
import { slug as toSlug } from '../../common/utils/slug.js'
import { AUTH_FEATURE, AUTH_ID, AUTH_SPEC } from '../auth/providers/auth.js'
import { ProjectService } from '../project/project.service.js'
import { HISTORY, Runs, VIDEO, type Run } from './providers/runs.js'
import { eventsPathOf, Scenario, sourceOf } from './providers/scenario.js'
import { stampGherkinTags, stampPlaywrightTags, stampPlaywrightTitle, stampTitle } from './providers/test-artifact.js'
import type { UpdateScenarioDto } from './dto/update-scenario.dto.js'
import type { RunStep, ScenarioResponse, ScenarioRunResponse } from './dto/responses/scenario.response.js'

/** O evento do reporter visto como dado, e não como união fechada. */
export type RunEventRecord = Record<string, unknown>

function asString(value: unknown): string | null {
    return typeof value === 'string' && value !== '' ? value : null
}

@Injectable()
export class ScenarioService {
    constructor(private readonly projects: ProjectService) {}

    /** O cenário dentro do projeto; 404 quando qualquer um dos dois não existe. */
    private scenarioIn(slug: string, id: string): { path: string, scenario: Scenario } {
        const path = this.projects.pathOf(slug)

        return { path, scenario: Scenario.make(path, id) }
    }

    findOne(slug: string, id: string): ScenarioResponse {
        const { path, scenario } = this.scenarioIn(slug, id)

        return this.show(path, scenario)
    }

    /**
     * O `written` diz se o arquivo existe em disco: o cenário de autenticação existe antes dele,
     * porque é a tela do cenário que oferece a gravação que vai criá-lo.
     */
    private show(path: string, scenario: Scenario): ScenarioResponse {
        const data = scenario.data()
        const spec = join(path, data.spec)
        const feature = data.feature === null ? null : join(path, data.feature)
        const eventsFile = join(path, eventsPathOf(data.spec))
        const written = existsSync(spec)

        return {
            title: data.title,
            spec: data.spec,
            feature: data.feature,
            tags: data.tags,
            domain: data.domain,
            playwright: written ? sourceOf(spec) : '',
            gherkin: feature && existsSync(feature) ? readFileSync(feature, 'utf8') : null,
            events: existsSync(eventsFile) ? JSON.parse(readFileSync(eventsFile, 'utf8')) as unknown : [],
            updated_at: (written ? statSync(spec).mtime : new Date()).toISOString(),
            is_auth: scenario.isAuth(),
            runs: this.listRuns(path, scenario.id)
        }
    }

    remove(slug: string, id: string): void {
        const { path, scenario } = this.scenarioIn(slug, id)
        const data = scenario.data()

        rmSync(join(path, data.spec), { force: true })
        rmSync(join(path, eventsPathOf(data.spec)), { force: true })

        if (data.feature !== null) {
            rmSync(join(path, data.feature), { force: true })
        }
    }

    /** Reescreve o cenário, movendo os arquivos quando o nome muda; o setup de auth fica no caminho fixo. */
    update(slug: string, id: string, dto: UpdateScenarioDto): ScenarioResponse {
        const { path, scenario } = this.scenarioIn(slug, id)
        const auth = scenario.isAuth()
        const data = scenario.data()

        const domain = toSlug(dto.domain ?? '') || null
        const name = toSlug(dto.path) || 'teste'

        const specRelative = auth
            ? AUTH_SPEC
            : `tests/${domain === null ? '' : `${domain}/`}${name}.spec.ts`
        const featureRelative = auth
            ? AUTH_FEATURE
            : `features/${domain === null ? '' : `${domain}/`}${name}.feature`

        if (specRelative !== data.spec && existsSync(join(path, specRelative))) {
            throw new ValidationFailed({ path: ['Já existe um cenário com este nome neste domínio.'] })
        }

        const tags = dto.tags ?? []

        const gherkin = (dto.gherkin ?? '').trim() === ''
            ? null
            : stampGherkinTags(stampTitle(dto.gherkin!, dto.title), [])
        const playwright = stampPlaywrightTags(stampPlaywrightTitle(dto.playwright, dto.title), tags)

        mkdirSync(dirname(join(path, specRelative)), { recursive: true })
        writeFileSync(join(path, specRelative), `${playwright}\n`)

        if (gherkin === null) {
            rmSync(join(path, featureRelative), { force: true })
        } else {
            mkdirSync(dirname(join(path, featureRelative)), { recursive: true })
            writeFileSync(join(path, featureRelative), `${gherkin}\n`)
        }

        if (specRelative !== data.spec) {
            rmSync(join(path, data.spec), { force: true })

            if (data.feature !== null) {
                rmSync(join(path, data.feature), { force: true })
            }

            const oldEvents = join(path, eventsPathOf(data.spec))

            if (existsSync(oldEvents)) {
                renameSync(oldEvents, join(path, eventsPathOf(specRelative)))
            }
        }

        const newId = auth ? AUTH_ID : `${domain === null ? '' : `${domain}/`}${name}`

        return this.show(path, Scenario.make(path, newId))
    }

    /**
     * O histórico do cenário, da execução mais recente para a mais antiga. O vídeo guardado
     * pertence à execução mais recente que gravou um.
     */
    listRuns(path: string, id: string): ScenarioRunResponse[] {
        const history = new Runs(path, id)
        const video = history.video()
        const runs = history.all()
        const recorded = existsSync(video) ? runs.findIndex((run) => Boolean(run.video)) : -1

        return runs.map((run, index) => ({
            started_at: run.started_at,
            duration_ms: run.duration_ms,
            passed: run.passed,
            branch: run.branch ?? null,
            author: run.author ?? null,
            steps: run.steps ?? [],
            playwright: run.playwright ?? '',
            video_path: index === recorded ? video : null
        }))
    }

    /** Guarda a execução no histórico do cenário e a versiona, quando o projeto é repositório. */
    async persistRun(path: string, spec: string, events: RunEventRecord[], startedAt: Date): Promise<void> {
        const scenario = Scenario.fromSpec(path, spec)
        const runs = new Runs(path, scenario.id)
        const specFile = join(path, spec)

        mkdirSync(runs.directory(), { recursive: true })

        const video = this.copyVideo(events, runs.directory())
        const git = Git.in(path)

        const run: Run = {
            started_at: startedAt.toISOString(),
            duration_ms: this.durationMs(events),
            passed: this.passed(events),
            branch: await git.branch(),
            author: await git.author(),
            video,
            steps: this.steps(events),
            playwright: existsSync(specFile) ? sourceOf(specFile) : ''
        }

        runs.append(run)

        const committed = [`runs/${scenario.id}/${HISTORY}`]

        if (video) committed.push(`runs/${scenario.id}/${VIDEO}`)

        await (await git.commit(`chore: registrar execução de ${scenario.id}`, committed)).push()
    }

    /** A timeline dos passos: a falha corrige a linha que já existe em vez de empilhar outra. */
    private steps(events: RunEventRecord[]): RunStep[] {
        const started = events.find((event) => event.event === 'run:started')
        const declared = Array.isArray(started?.steps) ? started.steps as string[] : []

        const timeline: RunStep[] = declared.map((title) => ({
            title,
            status: 'waiting',
            duration_ms: 0,
            error: null
        }))

        for (const event of events) {
            if (event.event !== 'step' || event.status === 'pending') continue

            const ran: RunStep = {
                title: String(event.title),
                status: String(event.status),
                duration_ms: Number(event.durationMs ?? 0),
                error: asString(event.error)
            }

            const waiting = timeline.findIndex(
                (step) => step.title === ran.title && step.status === 'waiting'
            )

            if (waiting !== -1) {
                timeline[waiting] = ran

                continue
            }

            const green = ran.status === 'failed' ? this.lastGreen(timeline, ran.title) : -1

            if (green === -1) {
                timeline.push(ran)
            } else {
                timeline[green] = ran
            }
        }

        return timeline
    }

    private lastGreen(timeline: RunStep[], title: string): number {
        for (let index = timeline.length - 1; index >= 0; index--) {
            const step = timeline[index]!

            if (step.title === title && step.status === 'success') return index
        }

        return -1
    }

    private passed(events: RunEventRecord[]): boolean {
        const finished = events.filter((event) => event.event === 'run:finished').pop()

        return Boolean(finished?.passed ?? false)
    }

    private durationMs(events: RunEventRecord[]): number {
        return events
            .filter((event) => event.event === 'test' && event.status !== 'pending')
            .reduce((total, event) => total + Number(event.durationMs ?? 0), 0)
    }

    /** Copia o vídeo da execução para o diretório do histórico. */
    private copyVideo(events: RunEventRecord[], directory: string): boolean {
        const source = events
            .filter((event) => event.event === 'test')
            .map((event) => asString(event.videoPath))
            .find((path) => path !== null)

        if (!source || !existsSync(source)) return false

        copyFileSync(source, join(directory, VIDEO))

        return true
    }
}
