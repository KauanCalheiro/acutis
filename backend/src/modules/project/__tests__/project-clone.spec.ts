// @vitest-environment node
/**
 * Importar um projeto que já existe num repositório. Portado de
 * `backend-laravel/tests/Feature/V1/ProjectCloneTest.php`.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { slug as toSlug } from '../../../common/utils/slug.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let sourceRepo: string

beforeEach(async () => {
    api = await startApi()

    // Um repositório de verdade em disco: clonar de um endereço remoto deixaria o teste dependente
    // de rede, e o git não distingue local de remoto na hora de clonar.
    sourceRepo = join(mkdtempSync(join(tmpdir(), 'acutis-source-')), 'fonte')
    mkdirSync(sourceRepo, { recursive: true })

    const git = (args: string[]) => execFileSync('git', args, { cwd: sourceRepo, stdio: 'ignore' })

    git(['init', '-q'])
    writeFileSync(join(sourceRepo, 'README.md'), '# fonte\n')
    git(['-c', 'user.email=t@t.dev', '-c', 'user.name=Test', 'commit', '--allow-empty', '-qm', 'init'])
    git(['add', '-A'])
    git(['-c', 'user.email=t@t.dev', '-c', 'user.name=Test', 'commit', '-qm', 'readme'])
})

afterEach(async () => {
    await api.close()
    rmSync(sourceRepo, { recursive: true, force: true })
})

function clone(body: Record<string, unknown>) {
    return api.http.post('/api/v1/projects/create/clone').send(body)
}

it('clona um repositório público', async () => {
    const response = await clone({ url: sourceRepo, name: 'Cloned App' })

    expect(response.status).toBe(201)
    expect(response.body.name).toBe('Cloned App')
    expect(response.body.slug).toBe('cloned-app')
    expect(response.body.path).toBe(api.projectPath('cloned-app'))
    expect(response.body.repository).toBe(sourceRepo)
    expect(response.body.provider).toBeNull()
    expect(response.body.created_at).toBeDefined()

    const dir = api.projectPath('cloned-app')

    expect(existsSync(join(dir, '.git'))).toBe(true)
    expect(existsSync(join(dir, 'README.md'))).toBe(true)
    expect(existsSync(join(dir, 'acutis.json'))).toBe(true)

    const manifest = JSON.parse(readFileSync(join(dir, 'acutis.json'), 'utf8'))
    expect(manifest.name).toBe('Cloned App')
    expect(manifest.slug).toBe('cloned-app')
    expect(manifest).toHaveProperty('created_at')
    expect(manifest).toHaveProperty('version')
})

it('deriva o nome da url do repositório quando ele é omitido', async () => {
    const response = await clone({ url: sourceRepo })

    expect(response.status).toBe(201)
    expect(response.body.slug).toBe(toSlug(basename(sourceRepo)))
})

it('exige uma url', async () => {
    const response = await clone({})

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('url')
})

it('exige um token quando a autenticação é por token', async () => {
    const response = await clone({ url: 'https://github.com/acme/app.git', auth: 'token' })

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('token')
})

it('exige uma chave ssh quando a autenticação é por chave', async () => {
    const response = await clone({ url: 'git@github.com:acme/app.git', auth: 'ssh_key' })

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('ssh_key')
})

it('recusa um método de autenticação inválido', async () => {
    const response = await clone({ url: 'https://github.com/acme/app.git', auth: 'nope' })

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('auth')
})

it('recusa clonar sobre um projeto existente', async () => {
    mkdirSync(api.projectPath('cloned-app'), { recursive: true })

    const response = await clone({ url: sourceRepo, name: 'Cloned App' })

    expect(response.status).toBe(422)
    expect(response.body.errors).toHaveProperty('url')
})
