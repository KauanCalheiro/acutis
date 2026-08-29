// @vitest-environment node
/** O que a execução agrupada deixa para trás: uma linha por rodada, com os totais e cada cenário. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { RunnerService } from '../../../webdriver/runner/runner.service.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let dir: string

let queued: string[] = []

const runner = {
  streamProject: async (
    _path: string,
    _options: unknown,
    onEvent: (event: unknown) => void
  ): Promise<{ passed: boolean, output: string }> => {
    const body = queued.shift() ?? ''
    const events = body.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line) as Record<string, unknown>)

    for (const event of events) onEvent(event)

    return { passed: events.some(event => event.event === 'run:finished' && event.passed === true), output: '' }
  }
}

beforeEach(async () => {
  queued = []
  api = await startApi([], [{ provide: RunnerService, value: runner }])
  dir = api.projectPath('minha-loja')

  mkdirSync(join(dir, 'tests'), { recursive: true })
  writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja',
    slug: 'minha-loja',
    created_at: '2026-01-01T00:00:00+00:00',
    version: 1
  }))
  writeFileSync(join(dir, 'tests/entrar.spec.ts'), 'test.describe(\'Entrar\', () => {})')
  writeFileSync(join(dir, 'tests/comprar.spec.ts'), 'test.describe(\'Comprar\', () => {})')
})

afterEach(async () => {
  await api.close()
})

function runEvents(events: Record<string, unknown>[]): string {
  return `${events.map(event => JSON.stringify(event)).join('\n')}\n`
}

/** Dois cenários numa rodada: o primeiro passa, o segundo quebra no segundo passo. */
function mixedRun(): string {
  return runEvents([
    { event: 'run:started', total: 2, steps: [] },
    { event: 'test', id: 'a1', title: 'Entrar', file: join(dir, 'tests/entrar.spec.ts'), status: 'pending', steps: ['Acessar a home', 'Clicar em Entrar'] },
    { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'success', durationMs: 120, error: null },
    { event: 'step', testId: 'a1', title: 'Clicar em Entrar', status: 'success', durationMs: 300, error: null },
    { event: 'test', id: 'a1', title: 'Entrar', file: join(dir, 'tests/entrar.spec.ts'), status: 'success', durationMs: 900, error: null },
    { event: 'test', id: 'b2', title: 'Comprar', file: join(dir, 'tests/comprar.spec.ts'), status: 'pending', steps: ['Abrir o carrinho', 'Pagar'] },
    { event: 'step', testId: 'b2', title: 'Abrir o carrinho', status: 'success', durationMs: 200, error: null },
    { event: 'step', testId: 'b2', title: 'Pagar', status: 'failed', durationMs: 5000, error: 'timeout' },
    { event: 'test', id: 'b2', title: 'Comprar', file: join(dir, 'tests/comprar.spec.ts'), status: 'failed', durationMs: 5300, error: 'timeout' },
    { event: 'run:finished', status: 'failed', passed: false }
  ])
}

async function streamProject(query = ''): Promise<void> {
  queued.push(mixedRun())

  const response = await api.http.get(`/api/v1/projects/minha-loja/run/stream${query}`)

  expect(response.status).toBe(200)
}

function savedSuiteRuns(): Record<string, unknown>[] {
  return readFileSync(join(dir, 'runs/_suite/history.ndjson'), 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Record<string, unknown>)
}

it('guarda a execução agrupada com os totais da rodada', async () => {
  await streamProject()

  const runs = savedSuiteRuns()

  expect(runs).toHaveLength(1)
  expect(runs[0]!.passed).toBe(false)
  expect(runs[0]!.duration_ms).toBe(6200)
  expect(runs[0]!.totals).toEqual({ tests: 2, passed: 1, failed: 1, steps: 4 })
  expect(runs[0]!.started_at).toBeTruthy()
})

it('deixa o histórico pronto para o git de quem clonar', async () => {
  await streamProject()

  expect(readFileSync(join(dir, '.gitattributes'), 'utf8')).toContain('runs/**/history.ndjson merge=union')
})

it('guarda o resultado de cada cenário da rodada', async () => {
  await streamProject()

  expect(savedSuiteRuns()[0]!.tests).toEqual([
    {
      id: 'entrar',
      title: 'Entrar',
      spec: 'tests/entrar.spec.ts',
      passed: true,
      duration_ms: 900,
      steps: 2,
      failed_step: null
    },
    {
      id: 'comprar',
      title: 'Comprar',
      spec: 'tests/comprar.spec.ts',
      passed: false,
      duration_ms: 5300,
      steps: 2,
      failed_step: 'Pagar'
    }
  ])
})

it('guarda a busca que o usuário digitou, não o grep que ela virou', async () => {
  await streamProject('?grep=Entrar%7CComprar&filter=entr')

  expect(savedSuiteRuns()[0]!.filter).toBe('entr')
})

it('guarda a rodada sem filtro quando a busca estava vazia', async () => {
  await streamProject('?grep=Entrar%7CComprar')

  expect(savedSuiteRuns()[0]!.filter).toBeNull()
})

it('não registra rodada quando a execução é de um cenário só', async () => {
  queued.push(mixedRun())

  await api.http.get('/api/v1/projects/minha-loja/run/stream?spec=tests/entrar.spec.ts')

  expect(() => savedSuiteRuns()).toThrow()
})

it('descarta as rodadas mais antigas além das cinquenta mais novas', async () => {
  mkdirSync(join(dir, 'runs/_suite'), { recursive: true })
  writeFileSync(join(dir, 'runs/_suite/history.ndjson'), `${Array.from({ length: 50 }, (_value, index) => JSON.stringify({
    started_at: `2026-06-13T09:${String(index).padStart(2, '0')}:00.000Z`,
    duration_ms: 100,
    passed: true,
    filter: null,
    branch: null,
    author: null,
    totals: { tests: 1, passed: 1, failed: 0, steps: 1 },
    tests: []
  })).join('\n')}\n`)

  await streamProject()

  const runs = savedSuiteRuns()

  expect(runs).toHaveLength(50)
  expect(runs[0]!.started_at).toBe('2026-06-13T09:01:00.000Z')
})

it('devolve as rodadas da mais recente para a mais antiga', async () => {
  await streamProject()
  await streamProject()

  const response = await api.http.get('/api/v1/projects/minha-loja/runs')

  expect(response.status).toBe(200)
  expect(response.body.runs).toHaveLength(2)
  expect(new Date(response.body.runs[0].started_at).getTime())
    .toBeGreaterThanOrEqual(new Date(response.body.runs[1].started_at).getTime())
  expect(response.body.runs[0].totals.failed).toBe(1)
})

it('ordena pela data mesmo quando o arquivo está fora de ordem', async () => {
  mkdirSync(join(dir, 'runs/_suite'), { recursive: true })
  writeFileSync(join(dir, 'runs/_suite/history.ndjson'), [
    JSON.stringify({ started_at: '2026-06-13T09:00:00.000Z', duration_ms: 1, passed: true, filter: null, branch: null, author: null, totals: { tests: 0, passed: 0, failed: 0, steps: 0 }, tests: [] }),
    JSON.stringify({ started_at: '2026-06-11T09:00:00.000Z', duration_ms: 1, passed: true, filter: null, branch: null, author: null, totals: { tests: 0, passed: 0, failed: 0, steps: 0 }, tests: [] }),
    JSON.stringify({ started_at: '2026-06-12T09:00:00.000Z', duration_ms: 1, passed: true, filter: null, branch: null, author: null, totals: { tests: 0, passed: 0, failed: 0, steps: 0 }, tests: [] })
  ].join('\n') + '\n')

  const response = await api.http.get('/api/v1/projects/minha-loja/runs')

  expect(response.body.runs.map((run: { started_at: string }) => run.started_at)).toEqual([
    '2026-06-13T09:00:00.000Z',
    '2026-06-12T09:00:00.000Z',
    '2026-06-11T09:00:00.000Z'
  ])
})

it('devolve lista vazia para o projeto que nunca rodou', async () => {
  const response = await api.http.get('/api/v1/projects/minha-loja/runs')

  expect(response.status).toBe(200)
  expect(response.body.runs).toEqual([])
})
