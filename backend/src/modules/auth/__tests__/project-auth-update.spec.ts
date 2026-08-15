// @vitest-environment node
/** O setup de login editado à mão na tela. */
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
    mkdirSync(join(dir, 'tests'), { recursive: true })
    writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
        name: 'Minha Loja',
        slug: SLUG,
        created_at: '2026-01-01T00:00:00+00:00',
        version: 1
    }))
    writeFileSync(join(dir, 'tests/auth.setup.ts'), 'conteudo original')
})

afterEach(async () => {
    await api.close()
})

it('sobrescreve o setup de autenticação com o conteúdo editado', async () => {
    const response = await api.http
        .put(`/api/v1/projects/${SLUG}/auth`)
        .send({ authSetup: 'conteudo editado' })

    expect(response.status).toBe(200)
    expect(response.body.authSetup).toBe('conteudo editado')
    expect(readFileSync(join(dir, 'tests/auth.setup.ts'), 'utf8')).toBe('conteudo editado')
})

it('valida que o setup de autenticação é obrigatório', async () => {
    const response = await api.http.put(`/api/v1/projects/${SLUG}/auth`).send({ authSetup: '' })

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('authSetup')
})

it('devolve 404 para um projeto desconhecido', async () => {
    const response = await api.http.put('/api/v1/projects/nao-existe/auth').send({ authSetup: 'x' })

    expect(response.status).toBe(404)
})
