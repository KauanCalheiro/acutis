// @vitest-environment node
/** As sugestões de `data-testid` para os eventos sem seletor estável. */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { checkSelectors } from '../../rules/selector-rules.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { AiModule } from '../ai.module.js'

let api: Harness
let dir: string

const SLUG = 'minha-loja'

function write(relative: string, contents: string): void {
    const file = join(dir, relative)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents)
}

beforeEach(async () => {
    api = await startApi([AiModule])
    dir = api.projectPath(SLUG)

    write('acutis.json', JSON.stringify({ name: 'Minha Loja', slug: SLUG, created_at: '2026-01-01T00:00:00+00:00', version: 1 }))
    write('tests/login.spec.ts', "test.describe('Login', () => {})")
})

afterEach(async () => {
    await api.close()
})

function suggestions(scenario = 'login', slug = SLUG) {
    return api.http.post(`/api/v1/projects/${slug}/scenarios/${scenario}/suggestions`)
}

it('devolve a lista fixa para um evento sem test id', async () => {
    write('tests/login.events.json', JSON.stringify([
        { type: 'click', label: 'Entrar', selectors: { cssStable: '.btn-primary' } }
    ]))

    const response = await suggestions()

    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
})

it('devolve a lista fixa também quando o evento só tem seletor de classe', async () => {
    write('tests/login.events.json', JSON.stringify([
        { type: 'click', label: 'Entrar', selectors: { cssStable: '.btn-primary' } }
    ]))

    const response = await suggestions()

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(0)
})

it('não consulta modelo: eventos que já têm test id não mudam a resposta', async () => {
    write('tests/login.events.json', JSON.stringify([
        { type: 'click', label: 'Já tem testid', selectors: { dataTestId: 'login-entrar' } },
        { type: 'fill', label: 'Usuário', selectors: { cssStable: '#user' } }
    ]))

    const response = await suggestions()

    expect(response.status).toBe(200)
    expect(response.body).toEqual([])
})

/** A regra de nome continua valendo, e é ela que reprovaria um `loginSair` vindo de um modelo. */
it('não devolve nenhuma sugestão fora do padrão de nome', async () => {
    write('tests/login.events.json', JSON.stringify([
        { type: 'click', label: 'Entrar', selectors: { cssStable: '.btn-primary' } },
        { type: 'click', label: 'Sair', selectors: { cssStable: '.btn-ghost' } }
    ]))

    const response = await suggestions()

    expect(response.status).toBe(200)
    expect(checkSelectors(response.body)).toEqual([])
})

it('devolve lista vazia quando todo evento já tem test id', async () => {
    write('tests/login.events.json', JSON.stringify([
        { type: 'click', label: 'Entrar', selectors: { dataTestId: 'login-entrar' } }
    ]))

    const response = await suggestions()

    expect(response.status).toBe(200)
    expect(response.body).toHaveLength(0)
})

it('devolve 404 para um cenário desconhecido', async () => {
    const response = await suggestions('nao-existe')

    expect(response.status).toBe(404)
})

it('devolve 404 para um projeto desconhecido', async () => {
    const response = await suggestions('login', 'nao-existe')

    expect(response.status).toBe(404)
})
