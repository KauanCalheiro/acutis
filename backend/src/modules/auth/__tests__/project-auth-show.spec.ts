// @vitest-environment node
/**
 * O setup de login que o projeto já tem, para a tela mostrar e o usuário editar. Portado de
 * `backend-laravel/tests/Feature/V1/ProjectAuthShowTest.php`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
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

it('mostra o conteúdo do setup de autenticação existente', async () => {
    const content = "import { test as setup } from '@playwright/test'\n// login gravado"

    mkdirSync(join(dir, 'tests'), { recursive: true })
    writeFileSync(join(dir, 'tests/auth.setup.ts'), content)

    const response = await api.http.get(`/api/v1/projects/${SLUG}/auth`)

    expect(response.status).toBe(200)
    expect(response.body.authSetup).toBe(content)
})

it('devolve 404 quando o projeto ainda não tem setup de autenticação', async () => {
    const response = await api.http.get(`/api/v1/projects/${SLUG}/auth`)

    expect(response.status).toBe(404)
})

it('devolve 404 para um projeto desconhecido', async () => {
    const response = await api.http.get('/api/v1/projects/nao-existe/auth')

    expect(response.status).toBe(404)
})
