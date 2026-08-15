// @vitest-environment node
/**
 * O usuário disse que este projeto não tem login. Portado de
 * `backend-laravel/tests/Feature/V1/ProjectAuthSkipTest.php`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { AuthModule } from '../auth.module.js'

let api: Harness
let dir: string

const SLUG = 'minha-loja'

beforeEach(async () => {
    api = await startApi([AuthModule])

    dir = api.projectPath(SLUG)
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
        name: 'Minha Loja',
        slug: SLUG,
        created_at: '2026-01-01T00:00:00+00:00',
        version: 1
    }))
})

afterEach(async () => {
    await api.close()
})

it('marca o projeto como dispensado de autenticação', async () => {
    await api.http.post(`/api/v1/projects/${SLUG}/auth/skip`).expect(204)

    const response = await api.http.get(`/api/v1/projects/${SLUG}`)

    expect(response.status).toBe(200)
    expect(response.body.auth_status).toBe('skipped')
})

it('preserva o resto do manifesto', async () => {
    await api.http.post(`/api/v1/projects/${SLUG}/auth/skip`).expect(204)

    const manifest = JSON.parse(readFileSync(join(dir, 'acutis.json'), 'utf8'))

    expect(manifest.name).toBe('Minha Loja')
    expect(manifest.slug).toBe(SLUG)
    expect(manifest.auth_skipped).toBe(true)
})

it('devolve 404 para um projeto desconhecido', async () => {
    const response = await api.http.post('/api/v1/projects/nao-existe/auth/skip')

    expect(response.status).toBe(404)
})
