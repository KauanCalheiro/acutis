// @vitest-environment node
/**
 * O rascunho revisado virando arquivo no projeto. Portado de
 * `backend-laravel/tests/Feature/V1/ProjectTestsTest.php`.
 *
 * Os casos que falavam da IA continuam valendo sem ela: `envVars` é o que o rascunho declarou para
 * os valores sensíveis, venha de modelo ou do objeto fixo, e o aviso de descasamento entre nomes e
 * marcadores é do mesmo jeito responsabilidade de quem escreve.
 */
import { Logger } from '@nestjs/common'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { EnvKey } from '../../environment/env-key.js'
import type { RecordedEvent } from '../../../recording/events.js'
import { startApi, type Harness } from '../../../testing/harness.js'
import { GenerationModule } from './generation.module.js'

let api: Harness
let dir: string

const SLUG = 'portal-sistema'

const SPEC = [
    "import { test, expect } from '@playwright/test'",
    '',
    "test.describe('Login', () => {",
    "    test('entra', async ({ page }) => {})",
    '})'
].join('\n')

beforeEach(async () => {
    api = await startApi([GenerationModule])

    await api.http.post('/api/v1/projects/create/template').send({ name: 'Portal Sistema' }).expect(201)

    dir = api.projectPath(SLUG)
})

afterEach(async () => {
    vi.restoreAllMocks()
    await api.close()
})

function payload(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        title: 'Login do cliente',
        tags: ['@read', '@login'],
        domain: 'login',
        path: 'login-do-cliente',
        gherkin: '@rascunho\nFuncionalidade: Rascunho antigo\n  Cenário: entra',
        playwright: SPEC,
        ...overrides
    }
}

function write(body: Record<string, unknown> = payload(), slug = SLUG) {
    return api.http.post(`/api/v1/projects/${slug}/tests`).send(body)
}

function read(relative: string): string {
    return readFileSync(join(dir, relative), 'utf8')
}

/** Uma senha gravada, que é o evento sensível de todos os casos de variável. */
function passwordFill(timestamp = 2): RecordedEvent {
    return {
        type: 'fill',
        timestamp,
        url: 'https://sistema.test/login',
        selectors: { id: 'senha' } as never,
        label: 'Senha',
        value: 'topsecret123',
        sensitive: true
    }
}

it('escreve o rascunho editado numa pasta de domínio, no caminho informado', async () => {
    const response = await write()

    expect(response.status).toBe(200)
    expect(response.body.spec).toBe('tests/login/login-do-cliente.spec.ts')
    expect(response.body.feature).toBe('features/login/login-do-cliente.feature')

    expect(existsSync(join(dir, 'tests/login/login-do-cliente.spec.ts'))).toBe(true)
    expect(existsSync(join(dir, 'features/login/login-do-cliente.feature'))).toBe(true)
})

it('carimba o título e as tags editados para os artefatos refletirem o formulário', async () => {
    await write().expect(200)

    const feature = read('features/login/login-do-cliente.feature')
    const spec = read('tests/login/login-do-cliente.spec.ts')

    expect(feature).toContain('Funcionalidade: Login do cliente')
    expect(feature).not.toContain('Rascunho antigo')
    // As tags moram só no spec: no .feature elas eram uma segunda fonte para a mesma informação.
    expect(feature).not.toContain('@')
    expect(spec).toContain("tag: ['@read', '@login']")
})

it('lista o cenário escrito com o título, as tags e o domínio editados', async () => {
    await write().expect(200)

    const response = await api.http.get(`/api/v1/projects/${SLUG}`)

    expect(response.status).toBe(200)

    const ours = (response.body.scenarios as { title: string, tags: string[], domain: string }[])
        .find((scenario) => scenario.title === 'Login do cliente')

    expect(ours).toBeDefined()
    expect(ours!.tags).toEqual(['@read', '@login'])
    expect(ours!.domain).toBe('login')
})

it('escreve a gravação ao lado dos artefatos gerados', async () => {
    await write(payload({
        events: [
            { type: 'navigate', timestamp: 1, url: 'https://sistema.test/login', selectors: null, label: null, value: null, sensitive: false },
            passwordFill()
        ]
    })).expect(200)

    const events = read('tests/login/login-do-cliente.events.json')

    expect(events).toContain('"type":"navigate"')
    expect(events).toContain('"type":"fill"')
    expect(events).not.toContain('topsecret123')
    expect(JSON.parse(events)[1].value).toBe('{{SENSIVEL_1}}')
})

it('escreve o html capturado em arquivo próprio, mantendo os eventos legíveis', async () => {
    await write(payload({
        events: [
            { type: 'navigate', timestamp: 1, url: 'https://sistema.test/', selectors: null, label: null, value: null, html: null },
            { type: 'click', timestamp: 2, url: 'https://sistema.test/', selectors: { cssStable: '.btn' }, label: 'Salvar', value: null, html: '<div><button class="btn">Salvar</button></div>' }
        ]
    })).expect(200)

    expect(read('tests/login/login-do-cliente.events.json')).not.toContain('<button')
    expect(JSON.parse(read('tests/login/login-do-cliente.dom.json'))).toEqual({
        1: '<div><button class="btn">Salvar</button></div>'
    })
})

it('mantém o html capturado fora do git, já que só a máquina que gravou precisa dele', async () => {
    await write().expect(200)

    expect(read('.gitignore')).toContain('*.dom.json')
})

it('escreve no ambiente a variável que a ia declarou para um valor mascarado', async () => {
    await write(payload({
        playwright: "import { test } from '@playwright/test'\n// process.env.SENHA_UNIVATES",
        envVars: ['SENHA_UNIVATES'],
        events: [
            { type: 'navigate', timestamp: 1, url: 'https://sistema.test/login', selectors: null, label: null, value: null, sensitive: false },
            passwordFill()
        ]
    })).expect(200)

    const environment = JSON.parse(read('environments/ambiente.json'))

    expect(environment.vars).toContainEqual({ key: 'SENHA_UNIVATES', value: 'topsecret123', secret: false })
    expect(read('.gitignore')).toContain('environments')
})

it('mescla no ambiente sem atropelar as variáveis que já estavam lá', async () => {
    await api.http
        .post(`/api/v1/projects/${SLUG}/auth/credentials`)
        .send({ username: 'someone', password: 'oldpass' })
        .expect(204)

    await write(payload({
        envVars: ['SENHA_UNIVATES'],
        events: [passwordFill(1)]
    })).expect(200)

    const environment = JSON.parse(read('environments/ambiente.json'))

    expect(environment.vars).toContainEqual({ key: EnvKey.USER, value: 'someone', secret: false })
    expect(environment.vars).toContainEqual({ key: EnvKey.PASSWORD, value: 'oldpass', secret: true })
    expect(environment.vars).toContainEqual({ key: 'SENHA_UNIVATES', value: 'topsecret123', secret: false })
})

it('avisa quando há valor sensível mas a ia não declarou variável para ele', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    await write(payload({ envVars: [], events: [passwordFill(1)] })).expect(200)

    expect(warn).toHaveBeenCalledTimes(1)
})

it('avisa quando a ia declara mais variáveis do que há valores sensíveis', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    await write(payload({
        envVars: ['SENHA_UNIVATES', 'SEGUNDA_SENHA'],
        events: [passwordFill(1)]
    })).expect(200)

    expect(warn).toHaveBeenCalledTimes(1)
})

it('não avisa quando cada variável declarada casa com um valor sensível', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {})

    await write(payload({ envVars: ['SENHA_UNIVATES'], events: [passwordFill(1)] })).expect(200)

    expect(warn).not.toHaveBeenCalled()
})

it('evita sobrescrever um spec que já existe no mesmo caminho do domínio', async () => {
    const first = await write()
    const second = await write()

    expect(first.body.spec).toBe('tests/login/login-do-cliente.spec.ts')
    expect(second.body.spec).toBe('tests/login/login-do-cliente-2.spec.ts')
})

it('devolve 404 para um projeto que não existe', async () => {
    const response = await write(payload(), 'inexistente')

    expect(response.status).toBe(404)
})

it('valida o payload de escrita', async () => {
    const response = await write({ tags: 'nope' })

    expect(response.status).toBe(422)
    expect(Object.keys(response.body.errors)).toEqual(
        expect.arrayContaining(['title', 'path', 'domain', 'playwright'])
    )
})

/** Sem .feature o título é lido do describe do spec, então é lá que ele precisa ser carimbado. */
it('carimba o título editado no describe do spec', async () => {
    await write(payload({ gherkin: '', title: 'Cadastro de produto' })).expect(200)

    expect(read('tests/login/login-do-cliente.spec.ts')).toContain("test.describe('Cadastro de produto'")
})

/** O Gherkin é opcional: sem provedor de IA o rascunho chega sem ele, e o cenário existe do mesmo jeito. */
it('não escreve feature quando o rascunho chega sem gherkin', async () => {
    const response = await write(payload({ gherkin: '' }))

    expect(response.status).toBe(200)
    expect(response.body.spec).toBe('tests/login/login-do-cliente.spec.ts')
    expect(response.body.feature).toBeNull()

    expect(existsSync(join(dir, 'tests/login/login-do-cliente.spec.ts'))).toBe(true)
    expect(existsSync(join(dir, 'features/login/login-do-cliente.feature'))).toBe(false)
})

/** Título que vira nome de arquivo: sem teto, o modelo devolve a feature inteira e o sistema de arquivos recusa. */
it('recusa um título maior do que um nome de arquivo comporta', async () => {
    const response = await write(payload({ title: 'cenário '.repeat(40) }))

    expect(response.status).toBe(422)
    expect(Object.keys(response.body.errors)).toContain('title')
})

it('recusa um caminho maior do que um nome de arquivo comporta', async () => {
    const response = await write(payload({ path: 'caminho-'.repeat(20) }))

    expect(response.status).toBe(422)
    expect(Object.keys(response.body.errors)).toContain('path')
})
