/**
 * A autenticação do projeto. É para cá que vieram as Actions de `app/Action/Auth` —
 * `ShowProjectAuth`, `UpdateProjectAuth`, `SkipProjectAuth`, `WriteAuthRecordingToProject` e
 * `GenerateAuthSetupFromRecording` — agrupadas por domínio em vez de uma classe por operação.
 *
 * `SaveAuthCredentials` continua no `ProjectService`, onde já estava portada.
 */
import { Injectable } from '@nestjs/common'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { aiConfigured, fixedAuthSetup, writeGherkin } from '../../ai/stub.js'
import { NotFound } from '../../kernel/errors.js'
import { ActiveVars } from '../../playwright/active-vars.js'
import { Playwright } from '../../playwright/playwright.js'
import { Url } from '../../playwright/url.js'
import { Recording } from '../../recording/recording.js'
import { SpecEmitter } from '../../recording/spec-emitter.js'
import { checkAuth } from '../../rules/auth-rules.js'
import type { Violation } from '../../rules/violation.js'
import { RunnerService, type RunResult } from '../../../runner/runner.service.js'
import { EnvKey } from '../environment/env-key.js'
import { environmentVar } from '../environment/environment-var.js'
import type { Environments } from '../environment/environments.js'
import { readManifest } from '../manifest.js'
import { ProjectService } from '../project.service.js'
import { eventsPathOf, htmlPathOf } from '../scenario/scenario.js'
import { AUTH_FEATURE, AUTH_SPEC, ensureAuthConfig } from './auth.js'
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

/**
 * Roda o setup de verdade, dentro do laço de correção. Portado de `App\Ai\SpecRunner`, que falava
 * HTTP com o webdriver: agora é chamada de função no mesmo processo.
 *
 * Guarda o que aconteceu, porque quem chama lê o resultado depois do laço.
 */
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
            // Exceção do runner mataria a geração inteira; sem resultado o laço segue pelas regras.
            return null
        }
    }

    last(): RunResult | null {
        return this.result
    }
}

/**
 * A execução ficou verde mas não deixou sessão nenhuma: o login não se formou, e todo cenário
 * autenticado rodaria deslogado sem nada ter falhado.
 */
function sessionWarning(run: SpecRun | null): string[] {
    const result = run?.last() ?? null

    if (result === null || !result.passed) return []
    if (result.storageState !== undefined && result.storageState !== null) return []

    return ['sessao-nao-salva: A execução do login terminou sem gravar a sessão, '
        + 'e sem ela todo cenário autenticado roda deslogado.']
}

/**
 * O que ainda está quebrado quando o laço para. São dois casos e o usuário precisa dos dois: o que
 * o corretor nunca resolveria, como variável declarada sem valor, e o que ele tentou até o limite
 * sem conseguir.
 */
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
        const path = this.projects.pathOf(slug)

        mkdirSync(join(path, 'tests'), { recursive: true })
        writeFileSync(join(path, AUTH_SPEC), authSetup)

        return authSetup
    }

    /** O usuário disse que este projeto não tem login; a tela para de oferecer a gravação. */
    skip(slug: string): void {
        const path = this.projects.pathOf(slug)
        const manifest = { ...readManifest(path), auth_skipped: true }

        writeFileSync(join(path, 'acutis.json'), `${JSON.stringify(manifest, null, 4)}\n`)
    }

    /**
     * Converte o login gravado num `auth.setup.ts` e deixa o projeto pronto para executá-lo.
     * Portado de `WriteAuthRecordingToProject`.
     */
    async record(slug: string, input: AuthRecordingDto): Promise<GeneratedAuthSetup> {
        const path = this.projects.pathOf(slug)
        const environments = this.projects.environmentsOf(slug)
        const recording = Recording.make(input.events)
        const credentials = recording.credentials()

        const generated = await this.generate(environments, input, recording)

        ensureAuthConfig(path)
        writeFileSync(join(path, AUTH_SPEC), generated.authSetup)
        writeFileSync(
            join(path, eventsPathOf(AUTH_SPEC)),
            JSON.stringify(recording.withoutPasswords())
        )

        const html = recording.html()

        if (Object.keys(html).length > 0) {
            writeFileSync(join(path, htmlPathOf(AUTH_SPEC)), JSON.stringify(html))
        }

        this.writeFeature(path, input, recording)

        environments.ensure()

        if (credentials === null) return generated

        environments.set(EnvKey.USER, credentials.username)
        environments.set(EnvKey.PASSWORD, credentials.password, true)

        return generated
    }

    /** Portado de `GenerateAuthSetupFromRecording`. O arquivo é executado antes de voltar ao usuário. */
    private async generate(
        environments: Environments,
        input: AuthRecordingDto,
        recording: Recording
    ): Promise<GeneratedAuthSetup> {
        const vars = this.activeVars(environments, input, recording)
        // A URL do sistema, que é a do ambiente ativo; a gravação pode ter parado no host do SSO.
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
     * O laço de correção, e ele mora aqui e não dentro do agente: cada volta confere as regras,
     * executa o login e devolve o resultado ao corretor numa chamada única. O teto é código, então
     * não existe volta infinita nem passo gasto em conversa.
     *
     * Executar só o arquivo que já passou pelas regras: rodar navegador para descobrir o que uma
     * regra aponta de graça é o gasto mais caro do fluxo.
     */
    private async settle(
        recording: Recording,
        base: Url,
        vars: ActiveVars,
        run: SpecRun | null,
        emitted: Playwright
    ): Promise<[Playwright, string[]]> {
        // Sem provedor não há corretor: o que as regras apontam volta como aviso, para o usuário
        // resolver na tela em vez de a gravação do login morrer.
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

    /**
     * O login também é um cenário, então ganha o Gherkin dos outros — no caminho fixo do auth,
     * porque é o título dele que a tela mostra e o domínio sugerido não move o arquivo.
     *
     * Sem provedor de IA não há descrição a escrever, e o setup vale sozinho.
     */
    private writeFeature(path: string, input: AuthRecordingDto, recording: Recording): void {
        if (!aiConfigured()) return

        const { gherkin } = writeGherkin({
            baseUrl: input.baseUrl,
            events: recording.withoutPasswords()
        })

        const file = join(path, AUTH_FEATURE)

        mkdirSync(dirname(file), { recursive: true })
        writeFileSync(file, `${gherkin}\n`)
    }

    /**
     * O que esta gravação carrega conta como preenchido: a URL base e as credenciais são escritas
     * no ambiente logo depois, e sem isto todo primeiro login sairia acusado de variável vazia.
     *
     * A chave que o ambiente ainda não declara entra aqui também: no primeiro login do projeto
     * nenhuma das três existe, e o setup executaria sem credencial nenhuma.
     */
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

    /**
     * Sem URL de execução não há onde rodar, e aí o laço se guia só pelas regras.
     *
     * As credenciais vão junto porque o setup de login as lê: sem elas a execução falha por falta
     * de dado, e o corretor leria isso como problema do arquivo.
     */
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
