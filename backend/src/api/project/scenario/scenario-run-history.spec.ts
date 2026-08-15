// @vitest-environment node
/**
 * O que cada execução deixa para trás: a linha do tempo dos passos, o vídeo e o commit.
 * Portado de `backend-laravel/tests/Feature/V1/ScenarioRunHistoryTest.php`.
 *
 * O runner entra trocado por um dublê, como o `Http::fake` fazia no Pest: o que está sob teste é o
 * que a API faz com os eventos, não o Playwright que os produz.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { RunnerService } from '../../../runner/runner.service.js'
import { startApi, type Harness } from '../../testing/harness.js'
import { ScenarioModule } from './scenario.module.js'

let api: Harness
let dir: string
let history: string

/** Os ndjson que o dublê do runner vai emitir, um por execução, na ordem em que forem pedidos. */
let queued: string[] = []

const runner = {
    streamProject: async (
        _path: string,
        _options: unknown,
        onEvent: (event: unknown) => void
    ): Promise<{ passed: boolean, output: string }> => {
        const body = queued.shift() ?? ''
        const events = body.split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line) as Record<string, unknown>)

        for (const event of events) onEvent(event)

        return { passed: events.some((event) => event.event === 'run:finished' && event.passed === true), output: '' }
    }
}

beforeEach(async () => {
    queued = []
    api = await startApi([ScenarioModule], [{ provide: RunnerService, value: runner }])
    dir = api.projectPath('minha-loja')
    history = join(dir, 'runs/login/entrar')

    mkdirSync(join(dir, 'tests/login'), { recursive: true })
    writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
        name: 'Minha Loja',
        slug: 'minha-loja',
        created_at: '2026-01-01T00:00:00+00:00',
        version: 1
    }))
    writeFileSync(join(dir, 'tests/login/entrar.spec.ts'), "test.describe('Entrar', () => {})")
})

afterEach(async () => {
    await api.close()
})

function runEvents(events: Record<string, unknown>[]): string {
    return `${events.map((event) => JSON.stringify(event)).join('\n')}\n`
}

function passingRun(videoPath: string | null = null): string {
    return runEvents([
        { event: 'run:started', total: 1, steps: ['Acessar a home'] },
        { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'pending' },
        { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'success', durationMs: 120, error: null },
        { event: 'test', id: 'a1', title: 'Entrar', status: 'success', durationMs: 900, error: null, videoPath },
        { event: 'run:finished', status: 'passed', passed: true }
    ])
}

function failingRun(): string {
    return runEvents([
        { event: 'run:started', total: 1, steps: ['Acessar a home'] },
        { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'pending' },
        { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'failed', durationMs: 30000, error: 'locator resolveu como hidden' },
        { event: 'test', id: 'a1', title: 'Entrar', status: 'failed', durationMs: 30100, error: 'timeout', videoPath: null },
        { event: 'run:finished', status: 'failed', passed: false }
    ])
}

function abortedRun(): string {
    return runEvents([
        { event: 'run:started', total: 1, steps: ['Acessar a home', 'Clicar em Entrar', 'Ver o painel'] },
        { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'pending' },
        { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'success', durationMs: 120, error: null },
        { event: 'step', testId: 'a1', title: 'Clicar em Entrar', status: 'pending' },
        { event: 'step', testId: 'a1', title: 'Clicar em Entrar', status: 'failed', durationMs: 0, error: 'Test timeout of 30000ms exceeded.' },
        { event: 'test', id: 'a1', title: 'Entrar', status: 'failed', durationMs: 31982, error: 'Test timeout of 30000ms exceeded.', videoPath: null },
        { event: 'run:finished', status: 'failed', passed: false }
    ])
}

/** O passo fecha verde e o timeout do teste o corrige depois, com o mesmo título. */
function correctedRun(): string {
    return runEvents([
        { event: 'run:started', total: 1, steps: ['Acessar a home', 'Clicar em Entrar'] },
        { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'pending' },
        { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'success', durationMs: 120, error: null },
        { event: 'step', testId: 'a1', title: 'Clicar em Entrar', status: 'pending' },
        { event: 'step', testId: 'a1', title: 'Clicar em Entrar', status: 'success', durationMs: 6055, error: null },
        { event: 'step', testId: 'a1', title: 'Clicar em Entrar', status: 'failed', durationMs: 0, error: 'Test timeout of 10000ms exceeded.' },
        { event: 'test', id: 'a1', title: 'Entrar', status: 'failed', durationMs: 10100, error: 'Test timeout of 10000ms exceeded.', videoPath: null },
        { event: 'run:finished', status: 'failed', passed: false }
    ])
}

async function streamScenario(...bodies: string[]): Promise<void> {
    queued.push(...bodies)

    for (const _body of bodies) {
        const response = await api.http.get('/api/v1/projects/minha-loja/run/stream?spec=tests/login/entrar.spec.ts')

        expect(response.status).toBe(200)
    }
}

/** As execuções gravadas, da mais antiga para a mais recente, como estão no arquivo. */
function savedRuns(): Record<string, unknown>[] {
    return readFileSync(join(history, 'history.ndjson'), 'utf8')
        .split('\n')
        .filter((line) => line.trim() !== '')
        .map((line) => JSON.parse(line) as Record<string, unknown>)
}

function seedRuns(count: number): void {
    mkdirSync(history, { recursive: true })

    const lines = Array.from({ length: count }, (_value, index) => JSON.stringify({
        started_at: `2026-06-13T09:${String(index + 1).padStart(2, '0')}:00+00:00`,
        duration_ms: 100,
        passed: true,
        branch: null,
        author: null,
        video: false,
        steps: [],
        playwright: ''
    }))

    writeFileSync(join(history, 'history.ndjson'), `${lines.join('\n')}\n`)
}

function initRepository(): void {
    execFileSync('git', ['init', '-q', '-b', 'trunk', dir])
    execFileSync('git', ['-C', dir, 'config', 'user.email', 'testadora@acutis.dev'])
    execFileSync('git', ['-C', dir, 'config', 'user.name', 'Testadora'])
    execFileSync('git', ['-C', dir, 'commit', '--allow-empty', '-qm', 'init'])
}

function gitOutput(repository: string, args: string[]): string {
    return execFileSync('git', ['-C', repository, ...args], { encoding: 'utf8' })
}

function showScenario() {
    return api.http.get('/api/v1/projects/minha-loja/scenarios/login/entrar')
}

it('guarda a execução no histórico do cenário', async () => {
    await streamScenario(failingRun())

    const runs = savedRuns()

    expect(runs).toHaveLength(1)
    expect(runs[0]!.passed).toBe(false)
    expect(runs[0]!.duration_ms).toBe(30100)
    expect(runs[0]!.steps).toEqual([{
        title: 'Acessar a home',
        status: 'failed',
        duration_ms: 30000,
        error: 'locator resolveu como hidden'
    }])
    expect(runs[0]!.started_at).toBeTruthy()
})

it('mantém os passos que não chegaram a rodar depois da falha', async () => {
    await streamScenario(abortedRun())

    expect(savedRuns()[0]!.steps).toEqual([
        { title: 'Acessar a home', status: 'success', duration_ms: 120, error: null },
        { title: 'Clicar em Entrar', status: 'failed', duration_ms: 0, error: 'Test timeout of 30000ms exceeded.' },
        { title: 'Ver o painel', status: 'waiting', duration_ms: 0, error: null }
    ])
})

it('corrige um passo que fechou verde antes do timeout do teste alcançá-lo', async () => {
    await streamScenario(correctedRun())

    expect(savedRuns()[0]!.steps).toEqual([
        { title: 'Acessar a home', status: 'success', duration_ms: 120, error: null },
        { title: 'Clicar em Entrar', status: 'failed', duration_ms: 0, error: 'Test timeout of 10000ms exceeded.' }
    ])
})

it('guarda o playwright que rodou sem o wrapper do runner', async () => {
    writeFileSync(
        join(dir, 'tests/login/entrar.spec.ts'),
        "import { test } from '../../acutis-run'\ntest.describe('Entrar', () => {})"
    )

    await streamScenario(passingRun())

    expect(savedRuns()[0]!.playwright)
        .toBe("import { test } from '@playwright/test'\ntest.describe('Entrar', () => {})")
})

it('copia o vídeo da execução para o histórico', async () => {
    mkdirSync(join(dir, 'test-results/entrar'), { recursive: true })
    writeFileSync(join(dir, 'test-results/entrar/video.webm'), 'webm-bytes')

    await streamScenario(passingRun(join(dir, 'test-results/entrar/video.webm')))

    expect(readFileSync(join(history, 'last.webm'), 'utf8')).toBe('webm-bytes')
    expect(savedRuns()[0]!.video).toBe(true)
})

it('mantém todas as execuções do cenário num arquivo só', async () => {
    await streamScenario(failingRun(), passingRun())

    expect(savedRuns()).toHaveLength(2)
})

it('descarta as execuções mais antigas além das vinte mais novas', async () => {
    seedRuns(20)

    await streamScenario(failingRun())

    const runs = savedRuns()

    expect(runs).toHaveLength(20)
    expect(runs[0]!.started_at).toBe('2026-06-13T09:02:00+00:00')
    expect(runs[19]!.passed).toBe(false)
})

it('lista as execuções do cenário, da mais nova para a mais antiga', async () => {
    await streamScenario(failingRun(), passingRun())

    const response = await showScenario()

    expect(response.status).toBe(200)
    expect(response.body.runs).toHaveLength(2)
    expect(response.body.runs[0].passed).toBe(true)
    expect(response.body.runs[1].passed).toBe(false)
    expect(response.body.runs[1].steps[0].error).toBe('locator resolveu como hidden')
})

it('lista todo o histórico guardado, que é o que a interface busca e pagina', async () => {
    seedRuns(8)

    const response = await showScenario()

    expect(response.status).toBe(200)
    expect(response.body.runs).toHaveLength(8)
    expect(response.body.runs[0].started_at).toBe('2026-06-13T09:08:00+00:00')
    expect(response.body.runs[7].started_at).toBe('2026-06-13T09:01:00+00:00')
})

it('aponta o vídeo para a execução mais nova que gravou um', async () => {
    mkdirSync(join(dir, 'test-results/entrar'), { recursive: true })
    writeFileSync(join(dir, 'test-results/entrar/video.webm'), 'webm-bytes')

    await streamScenario(passingRun(join(dir, 'test-results/entrar/video.webm')), failingRun())

    const response = await showScenario()

    expect(response.status).toBe(200)
    expect(response.body.runs[0].video_path).toBeNull()
    expect(response.body.runs[1].video_path).toBe(join(history, 'last.webm'))
})

it('commita a execução quando o projeto é um repositório git', async () => {
    initRepository()

    await streamScenario(passingRun())

    const log = gitOutput(dir, ['log', '--name-only', '--pretty=format:%s'])

    expect(log).toContain('runs/login/entrar/history.ndjson')
    expect(log).toContain('chore: registrar execução de login/entrar')

    const run = savedRuns()[0]!

    expect(run.branch).toBe('trunk')
    expect(run.author).toBe('Testadora')
})

it('empurra a execução quando o projeto tem remote', async () => {
    const origin = join(api.root, 'origin.git')

    execFileSync('git', ['init', '-q', '--bare', origin])
    initRepository()
    execFileSync('git', ['-C', dir, 'remote', 'add', 'origin', origin])

    await streamScenario(passingRun())

    expect(gitOutput(origin, ['log', 'trunk', '--name-only', '--pretty=format:%s']))
        .toContain('runs/login/entrar/history.ndjson')
})

it('ainda guarda a execução quando o projeto não é um repositório git', async () => {
    await streamScenario(passingRun())

    expect(savedRuns()).toHaveLength(1)
})

it('não guarda histórico quando o projeto inteiro roda', async () => {
    queued.push(passingRun())

    const response = await api.http.get('/api/v1/projects/minha-loja/run/stream')

    expect(response.status).toBe(200)
    expect(existsSync(join(dir, 'runs'))).toBe(false)
})
