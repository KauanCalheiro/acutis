// @vitest-environment node
/** Listagem de projetos: filtro, busca, ordenação e paginação. */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
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

function makeProjectDir(name: string, slug: string, createdAt?: string): string {
    const dir = api.projectPath(slug)

    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
        name,
        slug,
        created_at: createdAt ?? new Date().toISOString(),
        version: 1
    }))

    return dir
}

function git(dir: string, args: string[]): void {
    execFileSync('git', args, { cwd: dir, stdio: 'ignore' })
}

it('lista todos os projetos ordenados por nome', async () => {
    makeProjectDir('Beta', 'beta')
    makeProjectDir('Alpha', 'alpha')

    const response = await api.http.get('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(2)
    expect(response.body.data[0].name).toBe('Alpha')
    expect(response.body.data[1].name).toBe('Beta')
    expect(response.body.data[0].repository).toBeNull()
    expect(response.body.data[0].provider).toBeNull()
})

it('devolve lista vazia quando não há projeto nenhum', async () => {
    const response = await api.http.get('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(0)
})

it('ignora diretórios sem o manifesto acutis.json', async () => {
    makeProjectDir('Real', 'real')
    mkdirSync(api.projectPath('not-a-project'), { recursive: true })

    const response = await api.http.get('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
})

it('filtra por nome, parcial e sem diferenciar maiúsculas', async () => {
    makeProjectDir('Checkout Flow', 'checkout-flow')
    makeProjectDir('Login Page', 'login-page')

    const response = await api.http.get('/api/v1/projects').query({ 'filter[name]': 'LOGIN' })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].slug).toBe('login-page')
})

it('filtra por slug', async () => {
    makeProjectDir('Checkout Flow', 'checkout-flow')
    makeProjectDir('Login Page', 'login-page')

    const response = await api.http.get('/api/v1/projects').query({ 'filter[slug]': 'checkout' })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(1)
    expect(response.body.data[0].slug).toBe('checkout-flow')
})

it('busca no nome e no slug ao mesmo tempo', async () => {
    makeProjectDir('Payments', 'payments')
    makeProjectDir('User Cart', 'user-cart')
    makeProjectDir('Wishlist', 'cart-wishlist')

    const response = await api.http.get('/api/v1/projects').query({ search: 'cart' })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(2)
})

it('ordena por nome descendente', async () => {
    makeProjectDir('Alpha', 'alpha')
    makeProjectDir('Zeta', 'zeta')

    const response = await api.http.get('/api/v1/projects').query({ sort: '-name' })

    expect(response.status).toBe(200)
    expect(response.body.data[0].name).toBe('Zeta')
    expect(response.body.data[1].name).toBe('Alpha')
})

it('ordena por data de criação descendente', async () => {
    makeProjectDir('Old', 'old', '2020-01-01T00:00:00+00:00')
    makeProjectDir('New', 'new', '2030-01-01T00:00:00+00:00')

    const response = await api.http.get('/api/v1/projects').query({ sort: '-created_at' })

    expect(response.status).toBe(200)
    expect(response.body.data[0].slug).toBe('new')
    expect(response.body.data[1].slug).toBe('old')
})

it('pagina com page[size] e page[number]', async () => {
    for (const i of [1, 2, 3, 4, 5]) {
        makeProjectDir(`Project ${i}`, `project-${i}`, `2020-0${i}-01T00:00:00+00:00`)
    }

    const response = await api.http.get('/api/v1/projects').query({
        sort: 'created_at',
        'page[size]': '2',
        'page[number]': '2'
    })

    expect(response.status).toBe(200)
    expect(response.body.data).toHaveLength(2)
    expect(response.body.data[0].slug).toBe('project-3')
    expect(response.body.meta.current_page).toBe(2)
    expect(response.body.meta.per_page).toBe(2)
    expect(response.body.meta.total).toBe(5)
})

/** `rev-parse` acharia o repositório de fora, e todo projeto herdaria o remote dele. */
it('não herda o remote de um repositório que envolve a pasta de projetos', async () => {
    mkdirSync(api.root, { recursive: true })
    git(api.root, ['init', '-q'])
    git(api.root, ['remote', 'add', 'origin', 'https://github.com/acme/parent.git'])

    makeProjectDir('Plain Project', 'plain-project')

    const response = await api.http.get('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(response.body.data[0].repository).toBeNull()
    expect(response.body.data[0].provider).toBeNull()
})

it('detecta o provedor de git a partir do remote', async () => {
    const dir = makeProjectDir('With Remote', 'with-remote')

    git(dir, ['init', '-q'])
    git(dir, ['remote', 'add', 'origin', 'https://github.com/acme/app.git'])

    const response = await api.http.get('/api/v1/projects')

    expect(response.status).toBe(200)
    expect(response.body.data[0].repository).toBe('https://github.com/acme/app.git')
    expect(response.body.data[0].provider).toBe('github')
})
