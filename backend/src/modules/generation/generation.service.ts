/** O que a gravação vira: primeiro um rascunho editável, depois os arquivos do projeto. */
import { Injectable, Logger } from '@nestjs/common'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { writeGherkin } from '../ai/agents/gherkin.js'
import { writeMetadata } from '../ai/agents/metadata.js'
import { SettingsService } from '../settings/settings.service.js'
import { slug as toSlug } from '../../common/utils/slug.js'
import { ActiveVars } from '../../common/playwright/active-vars.js'
import { Url } from '../../common/playwright/url.js'
import { Recording, SENSITIVE_PREFIX } from '../recording/recording.js'
import type { RecordedEvent } from '../recording/events.js'
import { SpecEmitter } from '../recording/spec-emitter.js'
import { checkSpec } from '../rules/spec-rules.js'
import type { Violation } from '../rules/violation.js'
import { EnvKey } from '../environment/providers/env-key.js'
import { environmentVar } from '../environment/providers/environment-var.js'
import { Environments } from '../environment/providers/environments.js'
import { ProjectService } from '../project/project.service.js'
import { eventsPathOf, htmlPathOf } from '../scenario/providers/scenario.js'
import {
    scenario as scenarioOf,
    stampGherkinTags,
    stampPlaywrightTags,
    stampPlaywrightTitle,
    stampTitle,
    title as titleOf,
    uniquePath
} from '../scenario/providers/test-artifact.js'
import type { DraftRecordingDto } from './dto/draft-recording.dto.js'
import type { WriteTestDto } from './dto/write-test.dto.js'

export interface TestDraft {
    title: string
    tags: string[]
    domain: string
    path: string
    gherkin: string
    playwright: string
    envVars: string[]
    /** O que só o usuário resolve, como variável declarada sem valor. */
    warnings: string[]
}

export interface WrittenTest {
    gherkin: string | null
    playwright: string
    spec: string
    feature: string | null
}

/** Os nomes escolhidos pela IA, indexados pelo marcador que cada um substitui. */
function markedNames(envVars: string[]): Record<string, string> {
    const names: Record<string, string> = {}

    envVars.forEach((name, position) => {
        names[`${SENSITIVE_PREFIX}${position + 1}`] = name
    })

    return names
}

/**
 * `@write` quando a gravação preenche ou envia formulário, `@read` quando só navega.
 *
 * ponytail: heurística fill/submit; clique que muta sem formulário passa por @read.
 */
function readWriteTag(events: RecordedEvent[]): string {
    return events.some((event) => ['fill', 'submit'].includes(event.type ?? '')) ? '@write' : '@read'
}

/** A lista final de tags, nesta ordem: @read/@write, as do modelo e @publico. */
function tagList(readWrite: string, suggested: string[], publico: boolean): string[] {
    const fromModel = suggested
        .map((tag) => (tag.startsWith('@') ? tag : `@${tag}`))
        .filter((tag) => !/^@(read|write|publico)$/.test(tag))

    return [...new Set([readWrite, ...fromModel, ...(publico ? ['@publico'] : [])])]
}

@Injectable()
export class GenerationService {
    private readonly logger = new Logger(GenerationService.name)

    constructor(
        private readonly projects: ProjectService,
        private readonly settings: SettingsService
    ) {}

    /** O rascunho editável: nada é escrito em disco até o usuário salvar. */
    async draft(slug: string, recording: DraftRecordingDto): Promise<TestDraft> {
        const path = this.projects.pathOf(slug)
        const events = Recording.make(recording.events)
        const environments = this.environments(path, recording)
        const base = new Url(environments.get(EnvKey.URL)?.value || recording.baseUrl)

        const written = this.settings.canUseAi()
            ? await writeGherkin(this.settings.resolved(), {
                baseUrl: recording.baseUrl,
                events: events.redacted(environments)
            })
            : null

        const gherkin = written?.gherkin ?? ''
        const domain = written?.domain ?? ''

        const emitter = new SpecEmitter(events, base, environments)
        const playwright = emitter.spec(titleOf(gherkin), scenarioOf(gherkin))
        const envVars = emitter.envVars()

        const issues = checkSpec(playwright, base, this.withDeclared(environments, events, envVars))

        const named = gherkin !== '' && this.settings.canUseAi()
            ? await writeMetadata(this.settings.resolved(), { gherkin, domain })
            : null

        const tags = tagList(readWriteTag(recording.events), named?.tags ?? [], recording.publico === true)

        const cleanGherkin = gherkin === '' ? '' : stampGherkinTags(gherkin, [])
        const title = titleOf(cleanGherkin)

        return {
            title,
            tags,
            domain,
            path: uniquePath(join(path, 'tests'), toSlug(title) || 'teste'),
            gherkin: cleanGherkin,
            playwright: stampPlaywrightTags(playwright.value, tags),
            envVars,
            warnings: issues.map((issue: Violation) => `${issue.rule}: ${issue.message}`)
        }
    }

    /** O rascunho revisado vira os arquivos do projeto. */
    write(slug: string, data: WriteTestDto): WrittenTest {
        const path = this.projects.pathOf(slug)
        const domain = toSlug(data.domain) || 'outros'
        const tags = data.tags ?? []

        const name = uniquePath(join(path, 'tests', domain), toSlug(data.path) || 'teste')
        const spec = `tests/${domain}/${name}.spec.ts`

        const gherkin = (data.gherkin ?? '').trim() === ''
            ? null
            : stampGherkinTags(stampTitle(data.gherkin!, data.title), [])

        const feature = gherkin === null ? null : `features/${domain}/${name}.feature`
        const playwright = stampPlaywrightTags(
            stampPlaywrightTitle(data.playwright, data.title),
            tags
        )

        this.put(join(path, spec), `${playwright}\n`)

        if (feature !== null) this.put(join(path, feature), `${gherkin}\n`)

        if (data.events) this.writeRecording(path, slug, spec, data.events, data.envVars ?? [])

        return { gherkin, playwright, spec, feature }
    }

    /** Guarda a gravação ao lado do spec, o DOM em arquivo próprio, e registra as variáveis que ela batizou. */
    private writeRecording(
        path: string,
        slug: string,
        spec: string,
        events: RecordedEvent[],
        envVars: string[]
    ): void {
        const recording = Recording.make(events)
        const environments = new ActiveVars(this.projects.environmentsOf(slug).activeVars())
        const names = markedNames(envVars)

        const warning = recording.unmatchedEnvWarning(names)

        if (warning) this.logger.warn(warning)

        const values = recording.envValues(names)

        if (Object.keys(values).length > 0) {
            this.projects.environmentsOf(slug).merge(values)
        }

        this.put(join(path, eventsPathOf(spec)), JSON.stringify(recording.redacted(environments)))

        const html = recording.html()

        if (Object.keys(html).length > 0) {
            this.put(join(path, htmlPathOf(spec)), JSON.stringify(html))
        }
    }

    private put(file: string, contents: string): void {
        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, contents)
    }

    /** As variáveis do ambiente ativo, com a URL desta gravação já preenchida. */
    private environments(path: string, recording: DraftRecordingDto): ActiveVars {
        return new ActiveVars(new Environments(path).activeVars().map(
            (variable) => variable.key === EnvKey.URL && !variable.value
                ? environmentVar(variable.key, recording.baseUrl, variable.secret)
                : variable
        ))
    }

    /** As mesmas variáveis, mais as que a IA acabou de batizar para os valores sensíveis. */
    private withDeclared(environments: ActiveVars, events: Recording, envVars: string[]): ActiveVars {
        if (envVars.length === 0) return environments

        const declared = Object.entries(events.envValues(markedNames(envVars)))
            .map(([key, value]) => environmentVar(key, value, true))

        return new ActiveVars([...environments.vars, ...declared])
    }
}
