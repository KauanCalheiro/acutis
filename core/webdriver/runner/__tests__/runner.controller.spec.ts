// @vitest-environment node
/** Os endpoints que o E2E usa para dirigir o runner, com o runner de verdade como dublê. */
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { RunnerService } from '../runner.service.js'
import type { RunEvent } from '../../../common/types/run.js'

let api: Harness

/** O runner falso: guarda o que pediram e devolve o que o teste combinou. */
const runner = {
  calls: [] as unknown[][],
  result: { passed: true, output: 'tudo verde' },
  events: [] as RunEvent[],

  run(spec: string, options: unknown) {
    runner.calls.push(['run', spec, options])

    return Promise.resolve(runner.result)
  },

  runProject(path: string, options: unknown) {
    runner.calls.push(['runProject', path, options])

    return Promise.resolve(runner.result)
  },

  streamProject(path: string, options: unknown, onEvent: (event: RunEvent) => void) {
    runner.calls.push(['streamProject', path, options])
    runner.events.forEach(onEvent)

    return Promise.resolve(runner.result)
  }
}

beforeEach(async () => {
  runner.calls = []
  runner.result = { passed: true, output: 'tudo verde' }
  runner.events = []

  api = await startApi([], [{ provide: RunnerService, value: runner }])
})

afterEach(async () => {
  await api.close()
})

it('roda um spec solto com a URL base e o ambiente pedidos', async () => {
  const response = await api.http.post('/runner/spec').send({
    spec: 'test()',
    baseUrl: 'https://app.test',
    env: { SENHA: '123' }
  })

  expect(response.status).toBe(201)
  expect(response.body).toEqual({ passed: true, output: 'tudo verde' })
  expect(runner.calls[0]).toEqual(['run', 'test()', { baseUrl: 'https://app.test', env: { SENHA: '123' } }])
})

it('roda o projeto filtrando por spec ou por grep', async () => {
  const response = await api.http.post('/runner/project').send({
    path: '/tmp/projeto',
    spec: 'login.spec.ts',
    grep: 'Login',
    env: {}
  })

  expect(response.status).toBe(201)
  expect(runner.calls[0]).toEqual(['runProject', '/tmp/projeto', { spec: 'login.spec.ts', grep: 'Login', env: {} }])
})

it('transmite os eventos da execução e reemite o fim com a saída do processo', async () => {
  runner.events = [
    { event: 'run:started', steps: ['abre o login'] } as RunEvent,
    { event: 'run:finished', status: 'failed', passed: false } as RunEvent
  ]
  runner.result = { passed: false, output: 'Error: no tests found' }

  const response = await api.http.post('/runner/project/stream').send({ path: '/tmp/projeto' })

  const lines = response.text.trim().split('\n').map(line => JSON.parse(line))

  expect(response.headers['content-type']).toContain('application/x-ndjson')
  expect(lines[0]).toMatchObject({ event: 'run:started' })
  expect(lines.at(-1)).toMatchObject({ event: 'run:finished', passed: false, output: 'Error: no tests found' })
})

it('encerra a transmissão mesmo quando o runner não reporta o fim', async () => {
  const response = await api.http.post('/runner/project/stream').send({})

  const lines = response.text.trim().split('\n').map(line => JSON.parse(line))

  expect(lines.at(-1)).toEqual({ event: 'run:finished', status: 'failed', passed: false })
  expect(runner.calls[0]).toEqual(['streamProject', '', { spec: undefined, grep: undefined, env: undefined }])
})

it('entrega o vídeo da execução', async () => {
  const video = join(mkdtempSync(join(tmpdir(), 'acutis-runner-')), 'last.webm')

  writeFileSync(video, 'gravação')

  const response = await api.http.get('/runner/video').query({ path: video })

  expect(response.status).toBe(200)
})

it('entrega somente o intervalo pedido pelo player de vídeo', async () => {
  const video = join(mkdtempSync(join(tmpdir(), 'acutis-runner-')), 'last.webm')

  writeFileSync(video, Buffer.alloc(200, 1))

  const response = await api.http
    .get('/runner/video')
    .query({ path: video })
    .set('Range', 'bytes=0-99')

  expect(response.status).toBe(206)
  expect(response.headers['content-range']).toBe('bytes 0-99/200')
  expect(response.body).toHaveLength(100)
})

it('devolve 404 para caminho que não é um vídeo da execução', async () => {
  expect((await api.http.get('/runner/video').query({ path: '/tmp/nao-existe.webm' })).status).toBe(404)
  expect((await api.http.get('/runner/video').query({ path: '/etc/passwd' })).status).toBe(404)
})

it('mantém os endpoints disponíveis no modelo local confiável', async () => {
  expect((await api.http.post('/runner/spec').send({ spec: 'test()' })).status).toBe(201)
  expect((await api.http.post('/runner/project').send({ path: '/tmp' })).status).toBe(201)
  expect((await api.http.get('/runner/video').query({ path: '/tmp/x.webm' })).status).toBe(404)

  const stream = await api.http.post('/runner/project/stream').send({ path: '/tmp' })

  expect(stream.status).toBe(200)
})
