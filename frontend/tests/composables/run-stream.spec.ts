import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useRunStream } from '~/composables/run-stream'

// ponytail: EventSource falso no lugar de servidor SSE — o teste empurra as mensagens
// na mão, que é a única coisa que a máquina de estados enxerga.
class FakeEventSource {
  static last: FakeEventSource | undefined

  onmessage: ((message: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  closed = false

  constructor(readonly url: string) {
    FakeEventSource.last = this
  }

  close() {
    this.closed = true
  }

  send(event: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }

  fail() {
    this.onerror?.()
  }
}

function source() {
  return FakeEventSource.last!
}

const original = globalThis.EventSource

beforeEach(() => {
  FakeEventSource.last = undefined
  globalThis.EventSource = FakeEventSource as unknown as typeof EventSource
})

afterEach(() => {
  globalThis.EventSource = original
})

function started(titles: string[]) {
  const stream = useRunStream(() => 'alpha-store')
  stream.start({ spec: 'login.spec.ts' })
  source().send({ event: 'run:started', steps: titles })

  return stream
}

describe('useRunStream', () => {
  it('opens the stream for the current slug and spec', () => {
    const stream = useRunStream(() => 'alpha-store')
    stream.start({ spec: 'login.spec.ts' })

    expect(source().url).toBe('/api/projects/alpha-store/run-stream?spec=login.spec.ts')
    expect(stream.running.value).toBe(true)
  })

  it('opens the stream with the grep filter when there is no single spec', () => {
    const stream = useRunStream(() => 'alpha-store')
    stream.start({ grep: 'Login do cliente|Cadastro de produto' })

    expect(source().url).toBe('/api/projects/alpha-store/run-stream?grep=Login+do+cliente%7CCadastro+de+produto')
  })

  it('seeds the whole timeline as waiting when the run starts', () => {
    const stream = started(['abre o login', 'preenche o email'])

    expect(stream.steps.value).toEqual([
      { title: 'abre o login', status: 'waiting' },
      { title: 'preenche o email', status: 'waiting' }
    ])
  })

  it('marks the seeded step as running instead of appending a duplicate', () => {
    const stream = started(['abre o login', 'preenche o email'])
    source().send({ event: 'step', title: 'preenche o email', status: 'pending' })

    expect(stream.steps.value).toHaveLength(2)
    expect(stream.steps.value[1]).toEqual({ title: 'preenche o email', status: 'running' })
  })

  it('appends a running step that was never seeded', () => {
    const stream = started(['abre o login'])
    source().send({ event: 'step', title: 'tira screenshot', status: 'pending' })

    expect(stream.steps.value).toEqual([
      { title: 'abre o login', status: 'waiting' },
      { title: 'tira screenshot', status: 'running' }
    ])
  })

  it('closes the most recent running step when the same title repeats', () => {
    const stream = started(['clica', 'clica'])
    source().send({ event: 'step', title: 'clica', status: 'pending' })
    source().send({ event: 'step', title: 'clica', status: 'pending' })
    source().send({ event: 'step', title: 'clica', status: 'success' })

    expect(stream.steps.value[0]!.status).toBe('running')
    expect(stream.steps.value[1]!.status).toBe('success')
  })

  it('exposes the failed step with its error', () => {
    const stream = started(['abre o login'])
    source().send({ event: 'step', title: 'abre o login', status: 'pending' })
    source().send({ event: 'step', title: 'abre o login', status: 'failed', error: 'locator não encontrado' })

    expect(stream.failedStep.value).toEqual({
      title: 'abre o login',
      status: 'failed',
      error: 'locator não encontrado'
    })
  })

  it('builds the video url from the reported path', () => {
    const stream = started(['abre o login'])
    source().send({ event: 'test', status: 'failed', videoPath: '/runs/1/video.webm' })

    expect(stream.videoUrl.value).toBe('http://localhost:4000/runner/video?path=%2Fruns%2F1%2Fvideo.webm')
  })

  it('ignores the video path while the test is still pending', () => {
    const stream = started(['abre o login'])
    source().send({ event: 'test', status: 'pending', videoPath: '/runs/1/video.webm' })

    expect(stream.videoUrl.value).toBeNull()
  })

  it('closes the stream and reports the result when the run finishes', () => {
    const onFinish = vi.fn()
    const stream = useRunStream(() => 'alpha-store')
    stream.start({ spec: 'login.spec.ts' }, onFinish)
    source().send({ event: 'run:finished', passed: true, output: 'tudo verde' })

    expect(source().closed).toBe(true)
    expect(stream.running.value).toBe(false)
    expect(stream.passed.value).toBe(true)
    expect(stream.output.value).toBe('tudo verde')
    expect(stream.testedAt.value).not.toBeNull()
    expect(onFinish).toHaveBeenCalledOnce()
  })

  it('reports a failure when the stream dies before any step arrives', () => {
    const stream = useRunStream(() => 'alpha-store')
    stream.start({ spec: 'login.spec.ts' })
    source().fail()

    expect(source().closed).toBe(true)
    expect(stream.running.value).toBe(false)
    expect(stream.steps.value).toEqual([{ title: 'Não foi possível executar o teste.', status: 'failed' }])
  })

  it('keeps the timeline already received when the stream dies mid-run', () => {
    const stream = started(['abre o login'])
    source().send({ event: 'step', title: 'abre o login', status: 'success' })
    source().fail()

    expect(stream.steps.value).toHaveLength(1)
    expect(stream.steps.value[0]!.title).toBe('abre o login')
  })

  it('lists each test that ran with the steps that belong to it', () => {
    const stream = started(['abre o login', 'cria o produto'])
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'pending' })
    source().send({ event: 'test', id: 't2', title: 'Cadastro de produto', status: 'pending' })
    source().send({ event: 'step', testId: 't1', title: 'abre o login', status: 'pending' })
    source().send({ event: 'step', testId: 't2', title: 'cria o produto', status: 'pending' })
    source().send({ event: 'step', testId: 't1', title: 'abre o login', status: 'success' })
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'success' })

    expect(stream.tests.value).toEqual([
      {
        id: 't1',
        title: 'Login do cliente',
        status: 'success',
        error: null,
        steps: [{ testId: 't1', title: 'abre o login', status: 'success', error: null }]
      },
      {
        id: 't2',
        title: 'Cadastro de produto',
        status: 'running',
        error: null,
        steps: [{ testId: 't2', title: 'cria o produto', status: 'running' }]
      }
    ])
  })

  it('seeds the whole timeline of a test as soon as it begins', () => {
    const stream = started([])
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'pending', steps: ['abre o login', 'entra'] })

    expect(stream.tests.value[0]!.steps).toEqual([
      { testId: 't1', order: 0, title: 'abre o login', status: 'waiting' },
      { testId: 't1', order: 1, title: 'entra', status: 'waiting' }
    ])
  })

  it('adopts the timeline seeded by the run instead of repeating it under the test', () => {
    const stream = started(['abre o login', 'entra'])
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'pending', steps: ['abre o login', 'entra'] })

    expect(stream.steps.value).toHaveLength(2)
    expect(stream.tests.value[0]!.steps).toHaveLength(2)
  })

  it('keeps the steps of a test in the order the test declared them', () => {
    // A semeadura do run é a soma dos arquivos: os títulos repetidos entre eles não dizem de quem são.
    const stream = started(['abre o login', 'salva'])
    source().send({ event: 'test', id: 't2', title: 'Cadastro', status: 'pending', steps: ['salva', 'abre o login'] })

    expect(stream.tests.value[0]!.steps.map(step => step.title)).toEqual(['salva', 'abre o login'])
  })

  it('puts a step that was never announced after the ones that were', () => {
    const stream = started([])
    source().send({ event: 'test', id: 't1', title: 'Login', status: 'pending', steps: ['abre o login', 'entra'] })
    source().send({ event: 'step', testId: 't1', title: 'tira screenshot', status: 'pending' })

    expect(stream.tests.value[0]!.steps.map(step => step.title)).toEqual(['abre o login', 'entra', 'tira screenshot'])
  })

  it('runs the step already seeded for the test instead of appending a duplicate', () => {
    const stream = started([])
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'pending', steps: ['abre o login', 'entra'] })
    source().send({ event: 'step', testId: 't1', title: 'entra', status: 'pending' })

    expect(stream.tests.value[0]!.steps).toEqual([
      { testId: 't1', order: 0, title: 'abre o login', status: 'waiting' },
      { testId: 't1', order: 1, title: 'entra', status: 'running' }
    ])
  })

  it('does not seed the test twice when it reports its result', () => {
    const stream = started([])
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'pending', steps: ['abre o login'] })
    source().send({ event: 'step', testId: 't1', title: 'abre o login', status: 'success' })
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'success', steps: ['abre o login'] })

    expect(stream.tests.value[0]!.steps).toHaveLength(1)
  })

  it('closes the step of the test that reported it, not the one running in parallel', () => {
    const stream = started(['clica', 'clica'])
    source().send({ event: 'step', testId: 't1', title: 'clica', status: 'pending' })
    source().send({ event: 'step', testId: 't2', title: 'clica', status: 'pending' })
    source().send({ event: 'step', testId: 't2', title: 'clica', status: 'failed', error: 'não achou o botão' })

    expect(stream.steps.value[0]!.status).toBe('running')
    expect(stream.steps.value[1]).toEqual({ testId: 't2', title: 'clica', status: 'failed', error: 'não achou o botão' })
  })

  it('keeps the error of a test that failed before any step', () => {
    const stream = started([])
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'pending' })
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'failed', error: 'Error: page.goto timed out' })

    expect(stream.tests.value[0]).toMatchObject({
      status: 'failed',
      error: 'Error: page.goto timed out',
      steps: []
    })
  })

  it('corrige o passo que já fechou verde quando o timeout do teste chega depois', () => {
    const stream = started(['abre o login'])
    source().send({ event: 'step', title: 'abre o login', status: 'pending' })
    source().send({ event: 'step', title: 'abre o login', status: 'success' })
    source().send({ event: 'step', title: 'abre o login', status: 'failed', error: 'Test timeout of 30000ms exceeded' })

    expect(stream.steps.value[0]).toMatchObject({
      status: 'failed',
      error: 'Test timeout of 30000ms exceeded'
    })
  })

  it('clears the tests of the previous run when the same stream starts again', () => {
    const stream = started(['abre o login'])
    source().send({ event: 'test', id: 't1', title: 'Login do cliente', status: 'success' })

    stream.start({ grep: 'Login do cliente' })

    expect(stream.tests.value).toEqual([])
  })

  it('clears the previous result when the same stream starts again', () => {
    const stream = started(['abre o login'])
    source().send({ event: 'run:finished', passed: true, output: 'tudo verde' })

    stream.start({ spec: 'login.spec.ts' })

    expect(stream.steps.value).toEqual([])
    expect(stream.passed.value).toBe(false)
    expect(stream.output.value).toBeNull()
    expect(stream.videoUrl.value).toBeNull()
  })
})
