// @vitest-environment node
/**
 * O pedido de correção de um cenário que falhou. Portado de
 * `backend-laravel/tests/Feature/V1/ScenarioFixTest.php`.
 *
 * No Laravel cada caso afirmava o que o agente recebia e devolvia. A IA está fora do escopo desta
 * versão, então os mesmos casos afirmam o objeto fixo do `stub.ts` — e, principalmente, que nada
 * mais do caminho mudou: 404, 422 e o spec intocado em disco continuam sendo o contrato.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../testing/harness.js'
import { AiModule } from './ai.module.js'
import { AI_DISABLED_SUMMARY } from './stub.js'

let api: Harness
let dir: string

const SLUG = 'minha-loja'
const SPEC = "await page.locator('#v-0').fill('482910')"

/** O corpo mínimo que o endpoint exige: o passo que quebrou e o erro do runner. */
const FAILURE = { step: 'Quando preencho o campo "Usuário ou código"', error: "locator('#v-0') resolved to hidden" }

function write(relative: string, contents: string): void {
    const file = join(dir, relative)

    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, contents)
}

beforeEach(async () => {
    // O `ApiModule` ainda não importa o módulo de IA; a integração é de quem coordena.
    api = await startApi([AiModule])
    dir = api.projectPath(SLUG)

    write('acutis.json', JSON.stringify({ name: 'Minha Loja', slug: SLUG, created_at: '2026-01-01T00:00:00+00:00', version: 1 }))
    write('tests/login.spec.ts', SPEC)
    write('tests/login.events.json', JSON.stringify([
        { type: 'fill', label: 'Usuário ou código', url: 'https://app.test/login', selectors: { id: 'v-0' } }
    ]))
    write('environments/ambiente.json', JSON.stringify({
        name: 'Ambiente',
        vars: [{ key: 'URL', value: 'https://app.test', secret: false }]
    }))
})

afterEach(async () => {
    await api.close()
})

function fix(scenario = 'login', body: object = FAILURE) {
    return api.http.post(`/api/v1/projects/${SLUG}/scenarios/${scenario}/fix`).send(body)
}

it('propõe a correção fixa para o passo que falhou', async () => {
    const response = await fix()

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ playwright: '', summary: AI_DISABLED_SUMMARY })
})

it('não consulta modelo nenhum: passo e erro não mudam a resposta', async () => {
    const primeira = await fix('login', FAILURE)
    const segunda = await fix('login', { step: 'outro passo', error: 'outro erro' })

    expect(primeira.body).toEqual(segunda.body)
})

it('não executa o spec para montar a resposta', async () => {
    // Sem ambiente não há URL onde rodar, e no Laravel era isto que decidia se o spec era executado.
    write('environments/ambiente.json', JSON.stringify({ name: 'Ambiente', vars: [] }))

    const response = await fix()

    expect(response.status).toBe(200)
    expect(response.body.summary).toBe(AI_DISABLED_SUMMARY)
})

it('não depende dos eventos gravados do cenário', async () => {
    write('tests/login.events.json', '[]')

    const response = await fix()

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ playwright: '', summary: AI_DISABLED_SUMMARY })
})

it('não escreve a proposta em disco', async () => {
    await fix().expect(200)

    expect(readFileSync(join(dir, 'tests/login.spec.ts'), 'utf8')).toBe(SPEC)
})

it('exige o passo que falhou e o erro', async () => {
    const response = await fix('login', {})

    expect(response.status).toBe(422)
})

it('devolve 404 para um cenário que não existe', async () => {
    const response = await fix('inexistente')

    expect(response.status).toBe(404)
})

it('responde o mesmo objeto fixo para a autenticação', async () => {
    write('tests/auth.setup.ts', "await page.locator('#v-9').fill(process.env.AUTH_USER)")
    write('tests/auth.events.json', JSON.stringify([
        { type: 'fill', label: 'Matrícula', url: 'https://app.test/login', selectors: { id: 'v-9' } }
    ]))

    const response = await fix('auth')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ playwright: '', summary: AI_DISABLED_SUMMARY })
})

it('não faz uma segunda tentativa: toda chamada devolve o mesmo', async () => {
    const primeira = await fix()
    const segunda = await fix()

    expect(primeira.body).toEqual({ playwright: '', summary: AI_DISABLED_SUMMARY })
    expect(segunda.body).toEqual(primeira.body)
})

it('devolve 404 para a autenticação quando o projeto não tem nenhuma', async () => {
    const response = await fix('auth')

    expect(response.status).toBe(404)
})
