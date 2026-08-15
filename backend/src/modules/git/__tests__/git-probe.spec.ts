// @vitest-environment node
/** Sondagem de repositório: é o que a tela usa para decidir se pede credencial antes de clonar. */
import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let sourceRepo: string

beforeEach(async () => {
    api = await startApi()

    sourceRepo = join(mkdtempSync(join(tmpdir(), 'acutis-repo-')), 'origem')
    mkdirSync(sourceRepo, { recursive: true })
    execFileSync('git', ['init', '-q'], { cwd: sourceRepo })
    execFileSync('git', [
        '-c', 'user.email=t@t.dev', '-c', 'user.name=Test',
        'commit', '--allow-empty', '-qm', 'init'
    ], { cwd: sourceRepo })
})

afterEach(async () => {
    await api.close()
})

it('reporta como público um repositório acessível', async () => {
    const response = await api.http.post('/api/v1/projects/probe').send({ url: sourceRepo })

    expect(response.status).toBe(200)
    expect(response.body.public).toBe(true)
})

it('reporta como não público um repositório inalcançável', async () => {
    const response = await api.http
        .post('/api/v1/projects/probe')
        .send({ url: join(tmpdir(), `acutis-nao-existe-${Date.now()}`) })

    expect(response.status).toBe(200)
    expect(response.body.public).toBe(false)
})

it('exige uma url', async () => {
    const response = await api.http.post('/api/v1/projects/probe').send({})

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('url')
})
