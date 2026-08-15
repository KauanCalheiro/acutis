// @vitest-environment node
/**
 * As credenciais que o usuário digita quando a gravação não as revela. Portado de
 * `backend-laravel/tests/Feature/V1/ProjectAuthCredentialsTest.php`.
 *
 * A rota `POST :project/auth/credentials` já é servida pelo `ProjectController`; este arquivo
 * exercita a que existe, e não uma segunda cópia dela.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../testing/harness.js'
import { EnvKey } from '../environment/env-key.js'
import { AuthModule } from './auth.module.js'

let api: Harness
let dir: string

const SLUG = 'portal-sistema'

beforeEach(async () => {
    api = await startApi([AuthModule])

    await api.http.post('/api/v1/projects/create/template').send({ name: 'Portal Sistema' }).expect(201)

    dir = api.projectPath(SLUG)
})

afterEach(async () => {
    await api.close()
})

function environment(): { vars: { key: string, value: string, secret: boolean }[] } {
    return JSON.parse(readFileSync(join(dir, 'environments/ambiente.json'), 'utf8'))
}

it('escreve no ambiente as credenciais que o usuário digitou', async () => {
    await api.http
        .post(`/api/v1/projects/${SLUG}/auth/credentials`)
        .send({ username: '482910', password: 'senha-real' })
        .expect(204)

    expect(environment().vars).toContainEqual({ key: EnvKey.USER, value: '482910', secret: false })
    expect(environment().vars).toContainEqual({ key: EnvKey.PASSWORD, value: 'senha-real', secret: true })
    expect(readFileSync(join(dir, '.gitignore'), 'utf8')).toContain('environments')
})

it('preserva as variáveis que o ambiente já tinha', async () => {
    await api.http
        .put(`/api/v1/projects/${SLUG}/environments/ambiente`)
        .send({ name: 'Ambiente', vars: [{ key: 'CHECKOUT_CARD', value: '4111111111111111' }] })
        .expect(200)

    await api.http
        .post(`/api/v1/projects/${SLUG}/auth/credentials`)
        .send({ username: 'user', password: 'pass' })
        .expect(204)

    const keys = environment().vars.map((variable) => variable.key)

    expect(keys).toContain('CHECKOUT_CARD')
    expect(keys).toContain(EnvKey.USER)
    expect(keys).toContain(EnvKey.PASSWORD)
})

it('valida as credenciais', async () => {
    const response = await api.http
        .post(`/api/v1/projects/${SLUG}/auth/credentials`)
        .send({ username: '' })

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('username')
    expect(response.body.errors).toHaveProperty('password')
})

it('devolve 404 para um projeto que não existe', async () => {
    const response = await api.http
        .post('/api/v1/projects/inexistente/auth/credentials')
        .send({ username: 'user', password: 'pass' })

    expect(response.status).toBe(404)
})
