// @vitest-environment node
/** O que a API responde quando o disco está num estado que ela não escreveu. */
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { Runs } from '../../scenario/providers/runs.js'

let api: Harness

beforeEach(async () => {
    api = await startApi()
})

afterEach(async () => {
    await api.close()
})

function project(slug: string, manifest: string): string {
    const dir = api.projectPath(slug)

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'acutis.json'), manifest)

    return dir
}

it('nomeia o projeto pela pasta quando o manifesto está corrompido', async () => {
    project('loja-quebrada', '{ isto não é json')

    const response = await api.http.get('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(response.body.data.map((item: { slug: string }) => item.slug)).toEqual(['loja-quebrada'])
})

it('lista vazio quando a raiz de projetos não existe', async () => {
    rmSync(api.root, { recursive: true, force: true })

    const response = await api.http.get('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ data: [], meta: { current_page: 1, per_page: 0, total: 0 } })
})

it('recusa renomear para um nome sem letra nem número', async () => {
    project('minha-loja', JSON.stringify({ name: 'Minha Loja', slug: 'minha-loja', created_at: '2026-01-01T00:00:00+00:00', version: 1 }))

    const response = await api.http.put('/api/v1/projects/minha-loja').send({ name: '###' })

    expect(response.status).toBe(422)
    expect(response.body.errors.name[0]).toContain('ao menos um caractere alfanumérico')
})

it('descarta a linha corrompida do histórico de execuções', () => {
    const dir = project('com-historico', JSON.stringify({ name: 'Com Histórico', slug: 'com-historico', created_at: '2026-01-01T00:00:00+00:00', version: 1 }))
    const runs = new Runs(dir, 'login')

    mkdirSync(runs.directory(), { recursive: true })
    writeFileSync(runs.file(), [
        JSON.stringify({ started_at: '2026-01-01T10:00:00.000Z', duration_ms: 10, passed: true }),
        '{ linha corrompida',
        ''
    ].join('\n'))

    expect(runs.all()).toHaveLength(1)
})
