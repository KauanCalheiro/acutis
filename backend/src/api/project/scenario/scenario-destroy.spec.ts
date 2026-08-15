// @vitest-environment node
/**
 * Remover um cenário leva junto tudo o que é dele: spec, feature e a gravação guardada.
 * Portado de `backend-laravel/tests/Feature/V1/ScenarioDestroyTest.php`.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../testing/harness.js'
import { ScenarioModule } from './scenario.module.js'

let api: Harness
let dir: string

beforeEach(async () => {
    api = await startApi([ScenarioModule])
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

function destroy(id: string) {
    return api.http.delete(`/api/v1/projects/minha-loja/scenarios/${id}`)
}

it('apaga os arquivos do cenário', async () => {
    write('tests/login.spec.ts', "test.describe('Login', () => {})")
    write('features/login.feature', 'Funcionalidade: Login')
    write('tests/login.events.json', '[]')

    expect((await destroy('login')).status).toBe(204)

    expect(existsSync(join(dir, 'tests/login.spec.ts'))).toBe(false)
    expect(existsSync(join(dir, 'features/login.feature'))).toBe(false)
    expect(existsSync(join(dir, 'tests/login.events.json'))).toBe(false)
})

it('apaga um cenário dentro de um domínio', async () => {
    write('tests/checkout/pagamento.spec.ts', "test.describe('Pagamento', () => {})")

    expect((await destroy('checkout/pagamento')).status).toBe(204)

    expect(existsSync(join(dir, 'tests/checkout/pagamento.spec.ts'))).toBe(false)
})

it('devolve 404 para um cenário desconhecido', async () => {
    mkdirSync(join(dir, 'tests'), { recursive: true })

    expect((await destroy('nao-existe')).status).toBe(404)
})

it('devolve 404 para um projeto desconhecido', async () => {
    const response = await api.http.delete('/api/v1/projects/nao-existe/scenarios/login')

    expect(response.status).toBe(404)
})
