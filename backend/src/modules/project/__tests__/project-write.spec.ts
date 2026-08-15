// @vitest-environment node
/**
 * Renomear e apagar projeto. Portado de `backend-laravel/tests/Feature/V1/ProjectUpdateTest.php` e
 * `ProjectDeleteTest.php`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let dir: string

beforeEach(async () => {
    api = await startApi()
    dir = api.projectPath('minha-loja')

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
        name: 'Minha Loja',
        slug: 'minha-loja',
        created_at: '2026-01-01T00:00:00+00:00',
        version: 1
    }))
})

afterEach(async () => {
    await api.close()
})

describe('renomear', () => {
    it('renomeia o projeto e move a pasta', async () => {
        const response = await api.http.put('/api/v1/projects/minha-loja').send({ name: 'Loja Nova' })

        expect(response.status).toBe(200)
        expect(response.body.name).toBe('Loja Nova')
        expect(response.body.slug).toBe('loja-nova')
        expect(response.body.created_at).toBe('2026-01-01T00:00:00+00:00')

        expect(existsSync(dir)).toBe(false)
        expect(existsSync(api.projectPath('loja-nova'))).toBe(true)

        const manifest = JSON.parse(readFileSync(join(api.projectPath('loja-nova'), 'acutis.json'), 'utf8'))
        expect(manifest.name).toBe('Loja Nova')
        expect(manifest.slug).toBe('loja-nova')
    })

    it('mantém a mesma pasta quando só o nome de exibição muda', async () => {
        const response = await api.http.put('/api/v1/projects/minha-loja').send({ name: 'MINHA loja' })

        expect(response.status).toBe(200)
        expect(response.body.slug).toBe('minha-loja')
        expect(existsSync(dir)).toBe(true)
    })

    it('exige um nome', async () => {
        const response = await api.http.put('/api/v1/projects/minha-loja').send({})

        expect(response.status).toBe(422)
        expect(response.body.errors).toHaveProperty('name')
    })

    it('recusa um nome que colide com outro projeto', async () => {
        const other = api.projectPath('outra-loja')
        mkdirSync(other, { recursive: true })
        writeFileSync(join(other, 'acutis.json'), JSON.stringify({ name: 'Outra Loja', slug: 'outra-loja' }))

        const response = await api.http.put('/api/v1/projects/minha-loja').send({ name: 'Outra Loja' })

        expect(response.status).toBe(422)
        expect(response.body.errors).toHaveProperty('name')
    })

    it('devolve 404 para um projeto desconhecido', async () => {
        const response = await api.http.put('/api/v1/projects/nao-existe').send({ name: 'Novo' })

        expect(response.status).toBe(404)
    })
})

describe('apagar', () => {
    it('apaga a pasta do projeto', async () => {
        const response = await api.http.delete('/api/v1/projects/minha-loja')

        expect(response.status).toBe(204)
        expect(existsSync(dir)).toBe(false)
    })

    it('devolve 404 para um projeto desconhecido', async () => {
        const response = await api.http.delete('/api/v1/projects/nao-existe')

        expect(response.status).toBe(404)
    })
})
