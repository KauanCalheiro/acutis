// @vitest-environment node
/** Criação de projeto a partir do template. */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness

beforeEach(async () => {
    api = await startApi()
})

afterEach(async () => {
    await api.close()
})

it('cria um projeto a partir do template', async () => {
    const response = await api.http
        .post('/api/v1/projects/create/template')
        .send({ name: 'My New Project' })

    expect(response.status).toBe(201)
    expect(response.body.name).toBe('My New Project')
    expect(response.body.slug).toBe('my-new-project')
    expect(response.body.path).toBe(api.projectPath('my-new-project'))
    expect(response.body.repository).toBeNull()
    expect(response.body.provider).toBeNull()
    expect(response.body.created_at).toBeDefined()

    const dir = api.projectPath('my-new-project')

    expect(existsSync(dir)).toBe(true)
    expect(existsSync(join(dir, 'playwright.config.ts'))).toBe(true)
    expect(existsSync(join(dir, 'tests/example.spec.ts'))).toBe(false)

    const packageJson = readFileSync(join(dir, 'package.json'), 'utf8')
    expect(packageJson).toContain('"name": "my-new-project"')
    expect(packageJson).not.toContain('{{name}}')

    expect(existsSync(join(dir, 'acutis.json'))).toBe(true)

    const manifest = JSON.parse(readFileSync(join(dir, 'acutis.json'), 'utf8'))
    expect(manifest.name).toBe('My New Project')
    expect(manifest.slug).toBe('my-new-project')
    expect(manifest).toHaveProperty('created_at')
    expect(manifest).toHaveProperty('version')
})

it('exige um nome', async () => {
    const response = await api.http.post('/api/v1/projects/create/template').send({})

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('name')
})

it('recusa um projeto duplicado', async () => {
    mkdirSync(api.projectPath('my-app'), { recursive: true })

    const response = await api.http
        .post('/api/v1/projects/create/template')
        .send({ name: 'My App' })

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('name')
})

it('recusa um nome que higienizado fica vazio', async () => {
    const response = await api.http.post('/api/v1/projects/create/template').send({ name: '!!!' })

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('name')
})
