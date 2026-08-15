// @vitest-environment node
/**
 * A tela de um projeto: cenários, estado do login, ambiente ativo e os links que ela oferece.
 * Portado de `backend-laravel/tests/Feature/V1/ProjectShowTest.php`.
 */
import { execFileSync } from 'node:child_process'
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let dir: string

beforeEach(async () => {
    api = await startApi()
    dir = api.projectPath('minha-loja')

    mkdirSync(dir, { recursive: true })
    writeManifest({})
})

afterEach(async () => {
    await api.close()
})

function writeManifest(extra: Record<string, unknown>): void {
    writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
        name: 'Minha Loja',
        slug: 'minha-loja',
        created_at: '2026-01-01T00:00:00+00:00',
        version: 1,
        ...extra
    }))
}

function authRun(startedAt: string, passed: boolean): void {
    mkdirSync(join(dir, 'runs/auth'), { recursive: true })
    appendFileSync(join(dir, 'runs/auth/history.ndjson'), `${JSON.stringify({
        started_at: startedAt,
        duration_ms: 1200,
        passed,
        steps: [],
        playwright: ''
    })}\n`)
}

function writeAuthSetup(): void {
    mkdirSync(join(dir, 'tests'), { recursive: true })
    writeFileSync(join(dir, 'tests/auth.setup.ts'), 'import { test as setup } from "@playwright/test"')
}

function show() {
    return api.http.get('/api/v1/projects/minha-loja')
}

describe('sessão e detalhes', () => {
    it('mostra o arquivo de sessão do ambiente ativo, que é o que o gravador carrega', async () => {
        mkdirSync(join(dir, 'environments'), { recursive: true })
        writeFileSync(join(dir, 'environments/homolog.json'), JSON.stringify({ name: 'Homolog', vars: [] }))
        writeFileSync(join(dir, '.env'), 'ENVIRONMENT=homolog\n')

        const response = await show()

        expect(response.status).toBe(200)
        expect(response.body.storage_state).toBe(join(dir, 'storage-state.homolog.json'))
    })

    it('cai no arquivo de sessão simples enquanto o projeto não tem ambiente', async () => {
        const response = await show()

        expect(response.status).toBe(200)
        expect(response.body.storage_state).toBe(join(dir, 'storage-state.json'))
    })

    it('mostra os detalhes do projeto', async () => {
        const response = await show()

        expect(response.status).toBe(200)
        expect(response.body.name).toBe('Minha Loja')
        expect(response.body.slug).toBe('minha-loja')
        expect(response.body.path).toBe(dir)
        expect(response.body.repository).toBeNull()
        expect(response.body.provider).toBeNull()
        expect(response.body.branch).toBeNull()
        expect(response.body.scenarios).toEqual([])
        expect(response.body.auth_status).toBe('unset')
        expect(response.body.created_at).toBeDefined()
        expect(response.body.updated_at).toBeDefined()
    })

    it('mostra a branch do git quando o projeto é um repositório', async () => {
        execFileSync('git', ['init', '-q', '-b', 'trunk'], { cwd: dir })
        execFileSync('git', [
            '-c', 'user.email=t@t.dev', '-c', 'user.name=Test',
            'commit', '--allow-empty', '-qm', 'init'
        ], { cwd: dir })

        const response = await show()

        expect(response.status).toBe(200)
        expect(response.body.branch).toBe('trunk')
    })

    it('devolve 404 para um projeto desconhecido', async () => {
        const response = await api.http.get('/api/v1/projects/nao-existe')

        expect(response.status).toBe(404)
    })
})

describe('estado da autenticação', () => {
    it('mostra configurado quando o auth.setup.ts existe e nunca rodou', async () => {
        writeAuthSetup()

        expect((await show()).body.auth_status).toBe('configured')
    })

    it('mostra falhando quando a última execução registrada não passou', async () => {
        writeAuthSetup()
        authRun('2026-01-01T10:00:00+00:00', true)
        authRun('2026-01-02T10:00:00+00:00', false)

        expect((await show()).body.auth_status).toBe('failing')
    })

    it('volta a configurado assim que uma execução mais nova passa', async () => {
        writeAuthSetup()
        authRun('2026-01-01T10:00:00+00:00', false)
        authRun('2026-01-02T10:00:00+00:00', true)

        expect((await show()).body.auth_status).toBe('configured')
    })

    it('mostra dispensado quando foi dispensado no manifesto', async () => {
        writeManifest({ auth_skipped: true })

        expect((await show()).body.auth_status).toBe('skipped')
    })

    it('prefere configurado a dispensado quando os dois valem', async () => {
        writeManifest({ auth_skipped: true })
        writeAuthSetup()

        expect((await show()).body.auth_status).toBe('configured')
    })
})

describe('cenários', () => {
    it('lista os cenários com título e tags vindos do spec', async () => {
        mkdirSync(join(dir, 'tests'), { recursive: true })
        mkdirSync(join(dir, 'features'), { recursive: true })

        writeFileSync(join(dir, 'tests/login-do-cliente.spec.ts'), `import { test, expect } from '@playwright/test'

test.describe('Login do cliente', { tag: ['@read', '@login'] }, () => {
    test('entra com credenciais válidas', async ({ page }) => {})
})`)

        writeFileSync(join(dir, 'features/login-do-cliente.feature'), `Funcionalidade: Login do cliente
  Cenário: entra com credenciais válidas`)

        const response = await show()

        expect(response.status).toBe(200)
        expect(response.body.scenarios).toHaveLength(1)
        expect(response.body.scenarios[0].title).toBe('Login do cliente')
        expect(response.body.scenarios[0].spec).toBe('tests/login-do-cliente.spec.ts')
        expect(response.body.scenarios[0].feature).toBe('features/login-do-cliente.feature')
        expect(response.body.scenarios[0].tags).toEqual(['@read', '@login'])
    })

    /** O login não é um cenário: ele roda antes de todos, e tem tela própria. */
    it('ignora o spec de autenticação nos cenários', async () => {
        writeAuthSetup()

        expect((await show()).body.scenarios).toEqual([])
    })

    it('cai no nome do arquivo quando não há título no describe', async () => {
        mkdirSync(join(dir, 'tests'), { recursive: true })
        writeFileSync(join(dir, 'tests/fluxo-solto.spec.ts'), `import { test } from '@playwright/test'
test('caso único', async ({ page }) => {})`)

        const response = await show()

        expect(response.body.scenarios[0].title).toBe('fluxo-solto')
        expect(response.body.scenarios[0].feature).toBeNull()
        expect(response.body.scenarios[0].tags).toEqual([])
    })
})

describe('link do editor', () => {
    it('monta a url do vscode a partir do caminho do host configurado', async () => {
        process.env.ACUTIS_PROJECTS_HOST_PATH = '/Users/dev/code/.acutis'

        const response = await show()

        expect(response.body.vscode_url).toBe('vscode://file/Users/dev/code/.acutis/minha-loja')

        delete process.env.ACUTIS_PROJECTS_HOST_PATH
    })

    it('cai no caminho dos projetos quando não há caminho de host configurado', async () => {
        delete process.env.ACUTIS_PROJECTS_HOST_PATH

        const response = await show()

        expect(response.body.vscode_url).toBe(`vscode://file${dir}`)
    })
})
