// @vitest-environment node
/**
 * A tela de um cenário: o par spec/feature, a gravação que o originou e o histórico.
 * Portado de `backend-laravel/tests/Feature/V1/ScenarioShowTest.php`.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../testing/harness.js'

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

function write(relative: string, content: string): void {
    mkdirSync(join(dir, relative, '..'), { recursive: true })
    writeFileSync(join(dir, relative), content)
}

function show(id: string) {
    return api.http.get(`/api/v1/projects/minha-loja/scenarios/${id}`)
}

it('mostra o conteúdo do cenário', async () => {
    write('tests/login.spec.ts', "test.describe('Login', { tag: ['@read'] }, () => {})")
    write('features/login.feature', 'Funcionalidade: Login')

    const response = await show('login')

    expect(response.status).toBe(200)
    expect(response.body.title).toBe('Login')
    expect(response.body.spec).toBe('tests/login.spec.ts')
    expect(response.body.feature).toBe('features/login.feature')
    expect(response.body.domain).toBeNull()
    expect(response.body.tags).toEqual(['@read'])
    expect(response.body.gherkin).toBe('Funcionalidade: Login')
    expect(response.body.playwright).toBe("test.describe('Login', { tag: ['@read'] }, () => {})")
    expect(response.body.events).toEqual([])
})

it('mostra o import do playwright no lugar do wrapper do runner', async () => {
    write('tests/login.spec.ts', "import { test, expect } from '../acutis-run'\ntest.describe('Login', () => {})")
    write('tests/checkout/pagamento.spec.ts', "import { test } from '../../acutis-run'\ntest.describe('Pagamento', () => {})")

    const login = await show('login')

    expect(login.status).toBe(200)
    expect(login.body.playwright).toBe("import { test, expect } from '@playwright/test'\ntest.describe('Login', () => {})")

    const pagamento = await show('checkout/pagamento')

    expect(pagamento.status).toBe(200)
    expect(pagamento.body.playwright).toBe("import { test } from '@playwright/test'\ntest.describe('Pagamento', () => {})")
})

it('mostra os eventos da gravação guardada', async () => {
    write('tests/login.spec.ts', "test.describe('Login', () => {})")
    write('tests/login.events.json', JSON.stringify([{ type: 'click', label: 'Entrar' }]))

    const response = await show('login')

    expect(response.status).toBe(200)
    expect(response.body.events[0].type).toBe('click')
    expect(response.body.events[0].label).toBe('Entrar')
})

it('mostra um cenário dentro de um domínio', async () => {
    write('tests/checkout/pagamento.spec.ts', "test.describe('Pagamento', () => {})")

    const response = await show('checkout/pagamento')

    expect(response.status).toBe(200)
    expect(response.body.domain).toBe('checkout')
    expect(response.body.spec).toBe('tests/checkout/pagamento.spec.ts')
})

it('mostra o setup de autenticação como um cenário próprio', async () => {
    write('tests/auth.setup.ts', "import { test as setup } from '@playwright/test'\nsetup('entrar', async () => {})")
    write('features/auth.feature', 'Funcionalidade: Entrar na plataforma')
    write('tests/auth.events.json', JSON.stringify([{ type: 'fill', label: 'Usuário' }]))

    const response = await show('auth')

    expect(response.status).toBe(200)
    expect(response.body.is_auth).toBe(true)
    expect(response.body.title).toBe('Entrar na plataforma')
    expect(response.body.spec).toBe('tests/auth.setup.ts')
    expect(response.body.feature).toBe('features/auth.feature')
    expect(response.body.gherkin).toBe('Funcionalidade: Entrar na plataforma')
    expect(response.body.playwright).toBe("import { test as setup } from '@playwright/test'\nsetup('entrar', async () => {})")
    expect(response.body.events[0].label).toBe('Usuário')
    expect(response.body.tags).toEqual([])
    expect(response.body.domain).toBeNull()
})

it('dá um título de mão ao cenário de autenticação enquanto ele não tem feature', async () => {
    write('tests/auth.setup.ts', "setup('entrar', async () => {})")

    const response = await show('auth')

    expect(response.status).toBe(200)
    expect(response.body.title).toBe('Autenticação')
    expect(response.body.feature).toBeNull()
    expect(response.body.gherkin).toBeNull()
})

it('mostra um cenário de autenticação vazio quando o projeto nunca o configurou', async () => {
    const response = await show('auth')

    expect(response.status).toBe(200)
    expect(response.body.is_auth).toBe(true)
    expect(response.body.title).toBe('Autenticação')
    expect(response.body.spec).toBe('tests/auth.setup.ts')
    expect(response.body.playwright).toBe('')
    expect(response.body.gherkin).toBeNull()
    expect(response.body.events).toEqual([])
    expect(response.body.runs).toEqual([])
    expect(response.body.updated_at).toBeDefined()
})

it('marca um cenário comum como não sendo o de autenticação', async () => {
    write('tests/login.spec.ts', "test.describe('Login', () => {})")

    expect((await show('login')).body.is_auth).toBe(false)
})

it('devolve 404 para um cenário desconhecido', async () => {
    mkdirSync(join(dir, 'tests'), { recursive: true })

    expect((await show('nao-existe')).status).toBe(404)
})

it('devolve 404 para um projeto desconhecido', async () => {
    const response = await api.http.get('/api/v1/projects/nao-existe/scenarios/login')

    expect(response.status).toBe(404)
})
