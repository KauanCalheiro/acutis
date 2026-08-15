/**
 * O que a gravação vira: primeiro um rascunho editável, depois os arquivos do projeto.
 *
 * Aqui vieram parar as Actions `GenerateTestsFromRecording` e `WriteDraftToProject`, agrupadas por
 * assunto em vez de uma classe por operação.
 *
 * O que ficou de fora, e por quê: o loop de correção (`ScenarioFixer`) e a execução do rascunho
 * (`SpecRunner`) dependiam do modelo e do runner remoto, e ambos ficaram para quando a IA voltar.
 * Sem corretor, o que as regras apontam volta como aviso para o usuário resolver na revisão — que é
 * exatamente o que o Laravel já fazia quando nenhum provedor estava configurado.
 */
import { Injectable, Logger } from '@nestjs/common'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { writeGherkin } from '../../../ai/agents/gherkin.js'
import { writeMetadata } from '../../../ai/agents/metadata.js'
import { SettingsService } from '../../../settings/settings.service.js'
import { slug as toSlug } from '../../../kernel/slug.js'
import { ActiveVars } from '../../../playwright/active-vars.js'
import { Url } from '../../../playwright/url.js'
import { Recording, SENSITIVE_PREFIX } from '../../../recording/recording.js'
import type { RecordedEvent } from '../../../recording/events.js'
import { SpecEmitter } from '../../../recording/spec-emitter.js'
import { checkSpec } from '../../../rules/spec-rules.js'
import type { Violation } from '../../../rules/violation.js'
import { EnvKey } from '../../environment/env-key.js'
import { environmentVar } from '../../environment/environment-var.js'
import { Environments } from '../../environment/environments.js'
import { ProjectService } from '../../project.service.js'
import { eventsPathOf, htmlPathOf } from '../scenario.js'
import {
    scenario as scenarioOf,
    stampGherkinTags,
    stampPlaywrightTags,
    stampPlaywrightTitle,
    stampTitle,
    title as titleOf,
    uniquePath
} from '../test-artifact.js'
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

/** Os nomes escolhidos pela IA chegam na ordem dos marcadores; aqui voltam a ser mapa. */
function markedNames(envVars: string[]): Record<string, string> {
    const names: Record<string, string> = {}

    envVars.forEach((name, position) => {
        names[`${SENSITIVE_PREFIX}${position + 1}`] = name
    })

    return names
}

/**
 * ponytail: heurística fill/submit = escrita; clique que muta sem formulário passa por @read, e o
 * agente decidia melhor — isto é só o fallback.
 */
function readWriteTag(events: RecordedEvent[]): string {
    return events.some((event) => ['fill', 'submit'].includes(event.type ?? '')) ? '@write' : '@read'
}

/**
 * A lista final de tags do teste.
 *
 * A ordem é a regra: primeiro @read ou @write, que é decisão de código e separa o que pode rodar
 * contra dados de verdade; depois as do modelo, que descrevem a área do fluxo; e @publico por
 * último, que é escolha de quem gravou. Nenhuma delas vem do Gherkin — ele não guarda tags.
 */
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
        // A URL do ambiente, e não a que abriu o navegador: é sobre ela que o spec concatena em
        // runtime. Gravar da raiz do host com o ambiente apontando para uma subpasta escrevia o
        // caminho dela duas vezes. Mesma leitura que o setup de autenticação já fazia.
        const base = new Url(environments.get(EnvKey.URL)?.value || recording.baseUrl)

        // Sem provedor de IA o cenário sai só da gravação: título, domínio e descrição ficam em
        // branco para o usuário preencher na revisão, e o spec continua vindo do emissor.
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

        // O agente que nomeia é o dono das tags. Sem IA não há quem sugira, e resta a que o código
        // decide sozinho — que é justamente a que não pode faltar.
        const named = gherkin !== '' && this.settings.canUseAi()
            ? await writeMetadata(this.settings.resolved(), { gherkin, domain })
            : null

        const tags = tagList(readWriteTag(recording.events), named?.tags ?? [], recording.publico === true)

        // O Gherkin descreve o fluxo e nada mais: a lista vazia apaga qualquer linha de tags que o
        // modelo tenha escrito mesmo instruído a não escrever.
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

        // O Gherkin é opcional: sem provedor de IA o rascunho chega sem ele, e aí não há .feature.
        // A lista vazia é intencional: as tags moram no spec, e o .feature nunca as recebe.
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

    /**
     * A gravação guardada ao lado do spec, e as variáveis que ela batizou.
     *
     * O DOM capturado vai para arquivo próprio: no de eventos ele os tornaria ilegíveis, e é a tool
     * que o busca quando o agente precisa, um evento por vez.
     */
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

    /**
     * A URL desta gravação conta como preenchida: é ela que o projeto passa a usar, e sem isto o
     * primeiro rascunho de um projeto novo sairia acusado de variável vazia.
     */
    private environments(path: string, recording: DraftRecordingDto): ActiveVars {
        return new ActiveVars(new Environments(path).activeVars().map(
            (variable) => variable.key === EnvKey.URL && !variable.value
                ? environmentVar(variable.key, recording.baseUrl, variable.secret)
                : variable
        ))
    }

    /**
     * As variáveis que a IA acabou de batizar para os valores sensíveis. Elas ainda não existem no
     * ambiente — só entram quando o rascunho for salvo — mas já valem para as regras, senão toda
     * variável nova sairia acusada de inexistente. Secretas porque o valor veio de evento sensível.
     */
    private withDeclared(environments: ActiveVars, events: Recording, envVars: string[]): ActiveVars {
        if (envVars.length === 0) return environments

        const declared = Object.entries(events.envValues(markedNames(envVars)))
            .map(([key, value]) => environmentVar(key, value, true))

        return new ActiveVars([...environments.vars, ...declared])
    }
}
