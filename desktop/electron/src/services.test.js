const { test } = require('node:test')
const assert = require('node:assert/strict')
const { execFileSync } = require('node:child_process')
const { existsSync, lstatSync, mkdirSync, rmSync, statSync, symlinkSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const { install, plan, resources } = require('./services')
const { layout } = require('./state')

function fixture() {
    return {
        res: resources('/opt/acutis'),
        paths: layout('/home/kauan', '0.1.0'),
        ports: { backend: 1111, frontend: 2222, webdriver: 3333 }
    }
}

test('aponta cada serviço para os outros', () => {
    const { res, paths, ports } = fixture()
    const services = plan(res, paths, ports, 'base64:x')
    const by = (name) => services.find((service) => service.name === name)

    assert.equal(by('frontend').env.NUXT_API_ACUTIS_URL, 'http://127.0.0.1:1111')
    assert.equal(by('frontend').env.NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL, 'http://127.0.0.1:3333')
    assert.equal(by('backend').env.WEBDRIVER_URL, 'http://127.0.0.1:3333')
    assert.equal(by('webdriver').env.CORS_ORIGIN, 'http://127.0.0.1:2222')
})

/**
 * O bundle é somente-leitura: se qualquer um destes apontasse para dentro dele, o backend quebraria
 * na primeira escrita — que acontece logo no primeiro request.
 */
test('mantém todo caminho gravável fora do bundle', () => {
    const { res, paths, ports } = fixture()
    const backend = plan(res, paths, ports, 'base64:x').find((s) => s.name === 'backend')

    for (const key of ['LARAVEL_STORAGE_PATH', 'DB_DATABASE', 'ACUTIS_PROJECTS_PATH']) {
        assert.ok(
            backend.env[key].startsWith('/home/kauan/.acutis'),
            `${key} deveria morar em ~/.acutis, mas aponta para ${backend.env[key]}`
        )
    }
})

test('roda o CLI do Playwright que veio no bundle', () => {
    const { res, paths, ports } = fixture()
    const webdriver = plan(res, paths, ports, 'base64:x').find((s) => s.name === 'webdriver')

    assert.equal(
        webdriver.env.ACUTIS_PLAYWRIGHT_CLI,
        '/opt/acutis/webdriver/node_modules/playwright/cli.js'
    )
})

/**
 * Sem git no bundle vale o do PATH, que é o único que enxerga as chaves e o credential helper do
 * usuário.
 */
test('cai no git do sistema quando o bundle não traz um', () => {
    assert.equal(resources('/opt/acutis').gitBin(), 'git')
})

test('pede ao gravador que abra o próprio navegador', () => {
    const { res, paths, ports } = fixture()
    const webdriver = plan(res, paths, ports, 'base64:x').find((s) => s.name === 'webdriver')

    assert.equal(webdriver.env.RECORDER_CDP_URL, '')
})

/**
 * O motivo de existir o payload: o empacotador achata symlink, e sem eles o node_modules perde
 * pacotes e o Chrome for Testing nem abre. Extrair tem que devolvê-los.
 */
test('extrai o payload com symlinks e permissões intactos', { skip: process.platform === 'win32' }, () => {
    const base = join(tmpdir(), `acutis-payload-${process.pid}`)
    const origem = join(base, 'origem')

    mkdirSync(join(origem, 'webdriver'), { recursive: true })
    writeFileSync(join(origem, 'php'), '#!/bin/sh\n', { mode: 0o755 })
    symlinkSync('../php', join(origem, 'webdriver/php-link'))

    const payload = join(base, 'payload.tar.gz')
    execFileSync('tar', ['czf', payload, '-C', origem, '.'])

    const destino = join(base, 'destino')
    const res = install(payload, destino)

    assert.ok(existsSync(res.bin('php')))
    assert.ok(existsSync(join(destino, '.installed')))
    assert.ok(lstatSync(join(destino, 'webdriver/php-link')).isSymbolicLink())
    assert.equal(statSync(res.bin('php')).mode & 0o111, 0o111, 'o php precisa continuar executável')

    rmSync(base, { recursive: true, force: true })
})

test('não extrai de novo quando a versão já está instalada', { skip: process.platform === 'win32' }, () => {
    const base = join(tmpdir(), `acutis-reinstall-${process.pid}`)
    const origem = join(base, 'origem')

    mkdirSync(origem, { recursive: true })
    writeFileSync(join(origem, 'php'), 'primeira')

    const payload = join(base, 'payload.tar.gz')
    execFileSync('tar', ['czf', payload, '-C', origem, '.'])

    const destino = join(base, 'destino')
    install(payload, destino)

    // Uma marca que só sobrevive se a segunda chamada não apagar e reextrair tudo.
    writeFileSync(join(destino, 'marca'), 'x')
    install(payload, destino)

    assert.ok(existsSync(join(destino, 'marca')))

    rmSync(base, { recursive: true, force: true })
})
