/** A autenticação do projeto: ler, editar, dispensar e gerar o `auth.setup.ts` a partir do login gravado. */
import { Injectable } from '@nestjs/common'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aiConfigured, fixedAuthSetup, writeGherkin } from '../ai/providers/stub.js'
import { NotFound } from '../../common/exceptions/errors.js'
import { put } from '../../common/utils/file.js'
import { ActiveVars } from '../../common/playwright/active-vars.js'
import { Playwright } from '../../common/playwright/playwright.js'
import { Url } from '../../common/playwright/url.js'
import { Recording } from '../recording/recording.js'
import { SpecEmitter } from '../recording/spec-emitter.js'
import { checkAuth } from '../rules/auth-rules.js'
import type { Violation } from '../rules/violation.js'
import { RunnerService, type RunResult } from '../../webdriver/runner/runner.service.js'
import { EnvKey } from '../environment/providers/env-key.js'
import { environmentVar } from '../environment/providers/environment-var.js'
import type { Environments } from '../environment/providers/environments.js'
import { patchManifest } from '../project/providers/manifest.js'
import { ProjectService } from '../project/project.service.js'
import { eventsPathOf, htmlPathOf } from '../scenario/providers/scenario.js'
import { AUTH_FEATURE, AUTH_SPEC, ensureAuthConfig } from './providers/auth.js'
import type { AuthRecordingDto } from './dto/auth-recording.dto.js'

/** Quantas voltas de correção o arquivo ganha antes de voltar como está, com os avisos. */
const MAX_FIX_ATTEMPTS = 2

/** O arquivo de sessão que a execução avulsa lê de volta. */
const SESSION_FILE = 'storage-state.json'

export interface GeneratedAuthSetup {
    authSetup: string
    credentialsNeeded: boolean
    /** O que só o usuário resolve, como variável declarada sem valor. */
    warnings: string[]
}

/** Roda o setup de verdade dentro do laço de correção, guardando o resultado da última execução. */
class SpecRun {
    private ranSpec: string | null = null

    private result: RunResult | null = null

    constructor(
        private readonly runner: RunnerService,
        private readonly baseUrl: string,
        private readonly env: Record<string, string>
    ) {}

    /** O resultado deste spec, executando só se ele mudou desde a última vez. */
    async ensure(spec: string): Promise<RunResult | null> {
        if (this.ranSpec === spec && this.result !== null) return this.result

        try {
            const result = await this.runner.run(spec, { baseUrl: this.baseUrl, env: this.env })

            this.ranSpec = spec
            this.result = result

            return result
        } catch {
            return null
        }
    }

    last(): RunResult | null {
        return this.result
    }
}

/** O aviso da execução que passou sem gravar sessão nenhuma. */
function sessionWarning(run: SpecRun | null): string[] {
    const result = run?.last() ?? null

    if (result === null || !result.passed) return []
    if (result.storageState !== undefined && result.storageState !== null) return []

    return ['sessao-nao-salva: A execução do login terminou sem gravar a sessão, '
        + 'e sem ela todo cenário autenticado roda deslogado.']
}

/** As violações que sobraram quando o laço parou, no formato que a tela mostra. */
function warningsFrom(issues: Violation[]): string[] {
    return issues.map((issue) => `${issue.rule}: ${issue.message}`)
}

@Injectable()
export class AuthService {
    constructor(
        private readonly projects: ProjectService,
        private readonly runner: RunnerService
    ) {}

    show(slug: string): string {
        const file = join(this.projects.pathOf(slug), AUTH_SPEC)

        if (!existsSync(file)) throw new NotFound('Autenticação não configurada.')

        return readFileSync(file, 'utf8')
    }

    update(slug: string, authSetup: string): string {
        put(join(this.projects.pathOf(slug), AUTH_SPEC), authSetup)

        return authSetup
    }

    /** O usuário disse que este projeto não tem login; a tela para de oferecer a gravação. */
    skip(slug: string): void {
        patchManifest(this.projects.pathOf(slug), { auth_skipped: true })
    }

    /** Converte o login gravado num `auth.setup.ts` e deixa o projeto pronto para executá-lo. */
    async record(slug: string, input: AuthRecordingDto): Promise<GeneratedAuthSetup> {
        const path = this.projects.pathOf(slug)
        const environments = this.projects.environmentsOf(slug)
        const recording = Recording.make(input.events)
        const credentials = recording.credentials()

        const generated = await this.generate(environments, input, recording)

        ensureAuthConfig(path)
        put(join(path, AUTH_SPEC), generated.authSetup)
        put(join(path, eventsPathOf(AUTH_SPEC)), JSON.stringify(recording.withoutPasswords()))

        const html = recording.html()

        if (Object.keys(html).length > 0) {
            put(join(path, htmlPathOf(AUTH_SPEC)), JSON.stringify(html))
        }

        this.writeFeature(path, input, recording)

        environments.ensure()

        if (credentials === null) return generated

        environments.set(EnvKey.USER, credentials.username)
        environments.set(EnvKey.PASSWORD, credentials.password, true)

        return generated
    }

    /** Emite o setup a partir da gravação, corrige o que der e o executa antes de devolvê-lo. */
    private async generate(
        environments: Environments,
        input: AuthRecordingDto,
        recording: Recording
    ): Promise<GeneratedAuthSetup> {
        const vars = this.activeVars(environments, input, recording)
        const base = new Url(vars.get(EnvKey.URL)?.value || input.baseUrl)
        const run = this.runFor(input, vars)

        const emitted = new SpecEmitter(recording, base, vars).authSetup()
        const [settled, warnings] = await this.settle(recording, base, vars, run, emitted)

        await run?.ensure(settled.value)

        return {
            authSetup: settled.value,
            credentialsNeeded: recording.credentials() === null,
            warnings: [...warnings, ...sessionWarning(run)]
        }
    }

    /**
     * O laço de correção: confere as regras, executa o login e devolve o resultado ao corretor,
     * até `MAX_FIX_ATTEMPTS`. Devolve o arquivo e os avisos que sobraram.
     */
    private async settle(
        recording: Recording,
        base: Url,
        vars: ActiveVars,
        run: SpecRun | null,
        emitted: Playwright
    ): Promise<[Playwright, string[]]> {
        if (!aiConfigured()) return [emitted, warningsFrom(checkAuth(emitted, base, vars))]

        const events = recording.withoutPasswords()
        let playwright = emitted

        for (let attempt = 0; attempt <= MAX_FIX_ATTEMPTS; attempt++) {
            const issues = checkAuth(playwright, base, vars)
            const fixable = issues.filter((issue) => issue.fixable)
            const result = fixable.length === 0 ? await run?.ensure(playwright.value) ?? null : null

            if ((fixable.length === 0 && result?.passed !== false) || attempt === MAX_FIX_ATTEMPTS) {
                return [playwright, warningsFrom(issues)]
            }

            playwright = new Playwright(fixedAuthSetup({
                spec: playwright.value,
                violations: fixable,
                error: result?.output,
                html: result?.html,
                events
            }).playwright)
        }

        return [playwright, []]
    }

    /** Escreve o `.feature` do login, no caminho fixo do auth. */
    private writeFeature(path: string, input: AuthRecordingDto, recording: Recording): void {
        if (!aiConfigured()) return

        const { gherkin } = writeGherkin({
            baseUrl: input.baseUrl,
            events: recording.withoutPasswords()
        })

        put(join(path, AUTH_FEATURE), `${gherkin}\n`)
    }

    /** As variáveis do ambiente ativo com a URL e as credenciais desta gravação já preenchidas. */
    private activeVars(
        environments: Environments,
        input: AuthRecordingDto,
        recording: Recording
    ): ActiveVars {
        const credentials = recording.credentials()
        const filled: Record<string, string> = {}

        if (input.baseUrl) filled[EnvKey.URL] = input.baseUrl
        if (credentials?.username) filled[EnvKey.USER] = credentials.username
        if (credentials?.password) filled[EnvKey.PASSWORD] = credentials.password

        const vars = environments.activeVars().map((variable) => (
            !variable.value && filled[variable.key]
                ? environmentVar(variable.key, filled[variable.key]!, variable.secret)
                : variable
        ))

        for (const [key, value] of Object.entries(filled)) {
            if (!vars.some((variable) => variable.key === key)) {
                vars.push(environmentVar(key, value, key === EnvKey.PASSWORD))
            }
        }

        return new ActiveVars(vars)
    }

    /** O executor do laço, com URL e credenciais no ambiente; null quando não há onde rodar. */
    private runFor(input: AuthRecordingDto, vars: ActiveVars): SpecRun | null {
        if (!input.executionUrl) return null

        const env: Record<string, string> = {
            [EnvKey.URL]: input.executionUrl,
            [EnvKey.STORAGE_STATE]: SESSION_FILE
        }

        for (const key of [EnvKey.USER, EnvKey.PASSWORD]) {
            const value = vars.get(key)?.value

            if (value) env[key] = value
        }

        return new SpecRun(this.runner, input.executionUrl, env)
    }
}
