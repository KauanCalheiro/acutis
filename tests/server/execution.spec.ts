// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApp, createRouter, toWebHandler } from 'h3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import runStream from '../../server/api/projects/[slug]/run-stream.get'
import run from '../../server/api/projects/[slug]/run.post'
import { RunnerService } from '../../core/webdriver/runner/runner.service'

const router = createRouter()
  .post('/api/projects/:slug/run', run)
  .get('/api/projects/:slug/run-stream', runStream)
const fetchApp = toWebHandler(createApp().use(router))

let root: string
let previousRoot: string | undefined

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'acutis-execution-nitro-'))
  previousRoot = process.env.ACUTIS_PROJECTS_PATH
  process.env.ACUTIS_PROJECTS_PATH = root
  const project = join(root, 'minha-loja')
  mkdirSync(project, { recursive: true })
  writeFileSync(join(project, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja', slug: 'minha-loja', created_at: '2026-01-01T00:00:00.000Z', version: 1
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
  if (previousRoot === undefined) delete process.env.ACUTIS_PROJECTS_PATH
  else process.env.ACUTIS_PROJECTS_PATH = previousRoot
})

function request(path: string, init?: RequestInit) {
  return fetchApp(new Request(`http://acutis.test${path}`, init))
}

describe('execution Nitro API', () => {
  it('runs a project directly with filters', async () => {
    const runner = vi.spyOn(RunnerService.prototype, 'runProject').mockResolvedValue({
      passed: true, output: '2 passed'
    })

    const response = await request('/api/projects/minha-loja/run', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ spec: 'tests/login.spec.ts', grep: '@smoke' })
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ passed: true, output: '2 passed' })
    expect(runner).toHaveBeenCalledWith(expect.stringContaining('/minha-loja'), expect.objectContaining({
      spec: 'tests/login.spec.ts', grep: '@smoke'
    }))
  })

  it('streams runner events as SSE from the same Nitro process', async () => {
    vi.spyOn(RunnerService.prototype, 'streamProject').mockImplementation(async (_path, _options, onEvent) => {
      onEvent({ event: 'run:started', title: 'execução', status: 'pending', passed: false })
      onEvent({ event: 'run:finished', title: 'fim', status: 'success', passed: true })
      return { passed: true, output: 'ok' }
    })

    const response = await request('/api/projects/minha-loja/run-stream?grep=@smoke')
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('text/event-stream')
    expect(body).toContain('"event":"run:started"')
    expect(body).toContain('"event":"run:finished"')
  })

  it('returns 404 before starting an unknown project', async () => {
    const response = await request('/api/projects/inexistente/run', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}'
    })
    expect(response.status).toBe(404)
  })
})
