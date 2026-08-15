// @vitest-environment node
/**
 * Executar o projeto: de uma vez, e em fluxo. Portado de
 * `backend-laravel/tests/Feature/V1/ProjectRunTest.php`.
 *
 * No Laravel o runner era outro serviço, e os testes o dublavam com `Http::fake`. Agora ele vive no
 * mesmo processo e é injetado, então o dublê entra por `overrideProvider` — nenhum navegador sobe.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RunnerService } from '../../../webdriver/runner/runner.service.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness

/** O que o runner recebeu na última chamada, que é o que os testes precisam afirmar. */
const calls: { path?: string, spec?: string, grep?: string, env?: Record<string, string> }[] = []

let runResult = { passed: true, output: '2 passed' }
let streamEvents: Record<string, unknown>[] = []

const runnerDouble = {
    runProject: vi.fn(async (path: string, options: Record<string, unknown>) => {
        calls.push({ path, ...options })

        return runResult
    }),
    streamProject: vi.fn(async (
        path: string,
        options: Record<string, unknown>,
        onEvent: (event: unknown) => void
    ) => {
        calls.push({ path, ...options })

        for (const event of streamEvents) onEvent(event)

        return runResult
    })
}

async function bareProject(): Promise<string> {
    const slug = 'projeto-execucao'
    const dir = api.projectPath(slug)

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'acutis.json'), JSON.stringify({ name: 'Projeto Execução', slug, version: 1 }))

    return slug
}

beforeEach(async () => {
    calls.length = 0
    runResult = { passed: true, output: '2 passed' }
    streamEvents = []

    api = await startApi([], [{ provide: RunnerService, value: runnerDouble }])
})

afterEach(async () => {
    await api.close()
})

it('roda o projeto inteiro e devolve o resultado', async () => {
    const slug = await bareProject()

    const response = await api.http.post(`/api/v1/projects/${slug}/run`).send({})

    expect(response.status).toBe(200)
    expect(response.body.passed).toBe(true)
    expect(response.body.output).toBe('2 passed')

    expect(calls[0]!.path!.endsWith(`/${slug}`)).toBe(true)
    expect(calls[0]!.spec).toBeUndefined()
    expect(calls[0]!.grep).toBeUndefined()
})

it('repassa um spec específico e uma tag ao runner', async () => {
    const slug = await bareProject()

    const response = await api.http
        .post(`/api/v1/projects/${slug}/run`)
        .send({ spec: 'tests/login.spec.ts', grep: '@smoke' })

    expect(response.status).toBe(200)
    expect(calls[0]!.spec).toBe('tests/login.spec.ts')
    expect(calls[0]!.grep).toBe('@smoke')
})

it('reporta uma execução que falhou', async () => {
    runResult = { passed: false, output: '1 failed' }
    const slug = await bareProject()

    const response = await api.http.post(`/api/v1/projects/${slug}/run`).send({})

    expect(response.status).toBe(200)
    expect(response.body.passed).toBe(false)
    expect(response.body.output).toBe('1 failed')
})

it('devolve 404 para um projeto que não existe', async () => {
    const response = await api.http.post('/api/v1/projects/inexistente/run').send({})

    expect(response.status).toBe(404)
})

it('serve o fluxo da execução como server-sent events', async () => {
    streamEvents = [
        { event: 'run:started', total: 1 },
        { event: 'test', id: 'a1', title: 'Acessando a página inicial', status: 'pending' },
        { event: 'test', id: 'a1', title: 'Acessando a página inicial', status: 'success', durationMs: 120 },
        { event: 'run:finished', passed: true }
    ]

    const slug = await bareProject()
    const response = await api.http.get(`/api/v1/projects/${slug}/run/stream`)

    expect(response.status).toBe(200)
    expect(response.headers['content-type']).toContain('text/event-stream')
    expect(response.text).toContain('data: {"event":"run:started","total":1}')
    expect(response.text).toContain('"title":"Acessando a página inicial"')
    expect(response.text).toContain('data: {"event":"run:finished","passed":true}')
})

/** O caminho é do container; a tela não tem o que fazer com ele e não deve recebê-lo. */
it('repassa spec e grep ao fluxo sem expor o caminho', async () => {
    streamEvents = [{ event: 'run:finished', passed: true }]

    const slug = await bareProject()
    const response = await api.http
        .get(`/api/v1/projects/${slug}/run/stream`)
        .query({ spec: 'tests/x.spec.ts', grep: '@smoke' })

    expect(response.status).toBe(200)
    expect(calls[0]!.spec).toBe('tests/x.spec.ts')
    expect(calls[0]!.grep).toBe('@smoke')
    expect(response.text).not.toContain(api.projectPath(slug))
})

it('entrega o último evento mesmo quando o fluxo termina sem quebra de linha', async () => {
    streamEvents = [{ event: 'run:started', total: 1 }, { event: 'run:finished', passed: true }]

    const slug = await bareProject()
    const response = await api.http.get(`/api/v1/projects/${slug}/run/stream`)

    expect(response.status).toBe(200)
    expect(response.text).toContain('data: {"event":"run:finished","passed":true}')
})

it('manda ao runner o ambiente ativo do projeto', async () => {
    const slug = await bareProject()
    const dir = api.projectPath(slug)

    mkdirSync(join(dir, 'environments'), { recursive: true })
    writeFileSync(join(dir, 'environments/homolog.json'), JSON.stringify({
        name: 'Homolog',
        vars: [{ key: 'URL', value: 'https://homolog.test', secret: false }]
    }))
    writeFileSync(join(dir, '.env'), 'ENVIRONMENT=homolog\n')

    await api.http.post(`/api/v1/projects/${slug}/run`).send({})

    expect(calls[0]!.env!.URL).toBe('https://homolog.test')
    expect(calls[0]!.env!.STORAGE_STATE).toBe('storage-state.homolog.json')
})
