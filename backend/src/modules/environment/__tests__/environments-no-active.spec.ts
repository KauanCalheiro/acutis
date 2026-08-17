// @vitest-environment node
/** O projeto sem ambiente ativo: quem guarda as variáveis é o `.env`. */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Environments } from '../providers/environments.js'

let dir: string

beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'acutis-env-'))
})

afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
})

function environments(): Environments {
    return new Environments(dir)
}

function env(): string {
    return readFileSync(join(dir, '.env'), 'utf8')
}

it('não tem ambiente ativo quando o projeto não declara nenhum', () => {
    expect(environments().active()).toBeNull()
    expect(environments().resolve()).toEqual({})
})

it('grava a variável no .env quando não há ambiente ativo', () => {
    environments().set('URL', 'https://app.test')

    expect(env()).toContain('URL=https://app.test')
})

it('grava várias variáveis no .env quando não há ambiente ativo', () => {
    environments().merge({ URL: 'https://app.test', SENHA: 'segredo' })

    expect(env()).toContain('URL=https://app.test')
    expect(env()).toContain('SENHA=segredo')
})

it('ignora arquivo de ambiente corrompido', () => {
    mkdirSync(join(dir, 'environments'), { recursive: true })
    writeFileSync(join(dir, 'environments', 'homologacao.json'), '{ isto não é json')
    writeFileSync(join(dir, 'environments', 'producao.json'), '"texto solto"')

    expect(environments().all()).toEqual([])
})
