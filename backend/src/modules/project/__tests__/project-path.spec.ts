// @vitest-environment node
/** O slug nunca sai da raiz de projetos, por mais `..` que traga. */
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let outside: string

beforeEach(async () => {
    api = await startApi()

    outside = join(api.root, '..', 'acutis-fora-da-raiz')

    mkdirSync(outside, { recursive: true })
    writeFileSync(join(outside, 'acutis.json'), JSON.stringify({ name: 'Fora', slug: 'fora' }))
})

afterEach(async () => {
    rmSync(outside, { recursive: true, force: true })
    await api.close()
})

it('não mostra o projeto que está fora da raiz', async () => {
    const response = await api.http.get(`/api/v1/projects/${encodeURIComponent('../acutis-fora-da-raiz')}`)

    expect(response.status).toBe(404)
})

it('não apaga o diretório que está fora da raiz', async () => {
    const response = await api.http.delete(`/api/v1/projects/${encodeURIComponent('../acutis-fora-da-raiz')}`)

    expect(response.status).toBe(404)
    expect(existsSync(join(outside, 'acutis.json'))).toBe(true)
})

it('não lista os cenários do projeto que está fora da raiz', async () => {
    const response = await api.http.get(`/api/v1/projects/${encodeURIComponent('../acutis-fora-da-raiz')}/environments`)

    expect(response.status).toBe(404)
})

it('continua achando o projeto que está dentro da raiz', async () => {
    const inside = api.projectPath('dentro')

    mkdirSync(inside, { recursive: true })
    writeFileSync(join(inside, 'acutis.json'), JSON.stringify({ name: 'Dentro', slug: 'dentro' }))

    const response = await api.http.get('/api/v1/projects/dentro')

    expect(response.status).toBe(200)
})
