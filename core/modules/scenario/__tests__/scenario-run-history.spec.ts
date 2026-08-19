// @vitest-environment node
/** O que cada execução deixa para trás: a linha do tempo dos passos, o vídeo e o commit. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { RunnerService } from '../../../webdriver/runner/runner.service.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { ScenarioService } from '../scenario.service.js'

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
    const events = body.split('\n').filter(line => line.trim() !== '').map(line => JSON.parse(line) as Record<string, unknown>)

    for (const event of events) onEvent(event)

    return { passed: events.some(event => event.event === 'run:finished' && event.passed === true), output: '' }
  }
}

beforeEach(async () => {
  queued = []
  api = await startApi([], [{ provide: RunnerService, value: runner }])
  dir = api.projectPath('minha-loja')
  history = join(dir, 'runs/login/entrar')

  mkdirSync(join(dir, 'tests/login'), { recursive: true })
  writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja',
    slug: 'minha-loja',
    created_at: '2026-01-01T00:00:00+00:00',
    version: 1
  }))
  writeFileSync(join(dir, 'tests/login/entrar.spec.ts'), 'test.describe(\'Entrar\', () => {})')
})

afterEach(async () => {
  await api.close()
})

function runEvents(events: Record<string, unknown>[]): string {
  return `${events.map(event => JSON.stringify(event)).join('\n')}\n`
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
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Record<string, unknown>)
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
    'import { test } from \'../../acutis-run\'\ntest.describe(\'Entrar\', () => {})'
  )

  await streamScenario(passingRun())

  expect(savedRuns()[0]!.playwright)
    .toBe('import { test } from \'@playwright/test\'\ntest.describe(\'Entrar\', () => {})')
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

/** Lê o stream conforme ele chega, em vez de esperar a resposta inteira. */
function streamChunks(received: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    api.http.get('/api/v1/projects/minha-loja/run/stream?spec=tests/login/entrar.spec.ts')
      .buffer(false)
      .parse((response, done) => {
        response.on('data', (chunk: Buffer) => received.push(chunk.toString()))
        response.on('end', () => done(null, null))
      })
      .end(error => error ? reject(error) : resolve())
  })
}

async function waitFor(condition: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (condition()) return

    await new Promise(resolve => setTimeout(resolve, 10))
  }

  throw new Error('O stream não emitiu nada no tempo esperado.')
}

/** O `run:finished` é o sinal para a interface recarregar: só pode sair com o histórico já gravado. */
it('só anuncia o fim depois de guardar a execução', async () => {
  const scenarios = api.get<ScenarioService>(ScenarioService)
  const persist = scenarios.persistRun.bind(scenarios)
  let release = (): void => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })

  vi.spyOn(scenarios, 'persistRun').mockImplementation(async (...args) => {
    await gate

    return persist(...args)
  })

  queued.push(passingRun())

  const received: string[] = []
  const streaming = streamChunks(received)

  try {
    await waitFor(() => received.join('').includes('run:started'))

    expect(received.join('')).not.toContain('run:finished')
  } finally {
    release()
  }

  await streaming
  await waitFor(() => received.join('').includes('run:finished'))

  expect(savedRuns()).toHaveLength(1)
})

/** Rodando o projeto (ou o filtro), cada teste que reportou vira uma execução no histórico dele. */
function projectRun(): string {
  return runEvents([
    { event: 'run:started', total: 2, steps: ['Acessar a home', 'Salvar o produto'] },
    { event: 'test', id: 'a1', title: 'Entrar', file: join(dir, 'tests/login/entrar.spec.ts'), status: 'pending', steps: ['Acessar a home'] },
    { event: 'test', id: 'a2', title: 'Cadastrar', file: join(dir, 'tests/produto/cadastrar.spec.ts'), status: 'pending', steps: ['Salvar o produto'] },
    { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'pending' },
    { event: 'step', testId: 'a1', title: 'Acessar a home', status: 'success', durationMs: 120, error: null },
    { event: 'test', id: 'a1', title: 'Entrar', file: join(dir, 'tests/login/entrar.spec.ts'), status: 'success', durationMs: 900, error: null, videoPath: null },
    { event: 'step', testId: 'a2', title: 'Salvar o produto', status: 'pending' },
    { event: 'step', testId: 'a2', title: 'Salvar o produto', status: 'failed', durationMs: 300, error: 'não achou o botão' },
    { event: 'test', id: 'a2', title: 'Cadastrar', file: join(dir, 'tests/produto/cadastrar.spec.ts'), status: 'failed', durationMs: 400, error: 'não achou o botão', videoPath: null },
    { event: 'run:finished', status: 'failed', passed: false }
  ])
}

async function streamProject(body: string): Promise<void> {
  queued.push(body)

  const response = await api.http.get('/api/v1/projects/minha-loja/run/stream')

  expect(response.status).toBe(200)
}

function savedRunsOf(id: string): Record<string, unknown>[] {
  return readFileSync(join(dir, 'runs', id, 'history.ndjson'), 'utf8')
    .split('\n')
    .filter(line => line.trim() !== '')
    .map(line => JSON.parse(line) as Record<string, unknown>)
}

it('guarda uma execução no histórico de cada cenário que rodou', async () => {
  mkdirSync(join(dir, 'tests/produto'), { recursive: true })
  writeFileSync(join(dir, 'tests/produto/cadastrar.spec.ts'), 'test.describe(\'Cadastrar\', () => {})')

  await streamProject(projectRun())

  expect(savedRunsOf('login/entrar')).toHaveLength(1)
  expect(savedRunsOf('produto/cadastrar')).toHaveLength(1)
})

it('dá a cada cenário o resultado e a duração do teste dele, não os do run inteiro', async () => {
  await streamProject(projectRun())

  const entrar = savedRunsOf('login/entrar')[0]!
  const cadastrar = savedRunsOf('produto/cadastrar')[0]!

  expect(entrar.passed).toBe(true)
  expect(entrar.duration_ms).toBe(900)
  expect(cadastrar.passed).toBe(false)
  expect(cadastrar.duration_ms).toBe(400)
})

it('dá a cada cenário só os passos que o teste dele anunciou', async () => {
  await streamProject(projectRun())

  expect(savedRunsOf('login/entrar')[0]!.steps).toEqual([
    { title: 'Acessar a home', status: 'success', duration_ms: 120, error: null }
  ])
  expect(savedRunsOf('produto/cadastrar')[0]!.steps).toEqual([
    { title: 'Salvar o produto', status: 'failed', duration_ms: 300, error: 'não achou o botão' }
  ])
})

it('commita as execuções do projeto inteiro de uma vez só', async () => {
  initRepository()

  await streamProject(projectRun())

  const subjects = gitOutput(dir, ['log', '--pretty=format:%s']).split('\n').filter(line => line.trim() !== '')
  const log = gitOutput(dir, ['log', '-1', '--name-only', '--pretty=format:%s'])

  expect(subjects).toHaveLength(2)
  expect(log).toContain('runs/login/entrar/history.ndjson')
  expect(log).toContain('runs/produto/cadastrar/history.ndjson')
})

it('ignora o teste cujo arquivo está fora do projeto', async () => {
  queued.push(runEvents([
    { event: 'run:started', total: 1, steps: [] },
    { event: 'test', id: 'a1', title: 'Vizinho', file: '/outro/projeto/tests/x.spec.ts', status: 'success', durationMs: 10, videoPath: null },
    { event: 'run:finished', status: 'passed', passed: true }
  ]))

  const response = await api.http.get('/api/v1/projects/minha-loja/run/stream')

  expect(response.status).toBe(200)
  expect(existsSync(join(dir, 'runs'))).toBe(false)
  expect(existsSync(join(dir, '../outro'))).toBe(false)
})

it('não guarda nada quando nenhum teste chegou a reportar', async () => {
  queued.push(runEvents([
    { event: 'run:started', total: 0, steps: [] },
    { event: 'run:finished', status: 'failed', passed: false }
  ]))

  const response = await api.http.get('/api/v1/projects/minha-loja/run/stream')

  expect(response.status).toBe(200)
  expect(existsSync(join(dir, 'runs'))).toBe(false)
})
