const { test } = require('node:test')
const assert = require('node:assert/strict')
const { existsSync, rmSync, statSync } = require('node:fs')
const { createServer } = require('node:net')
const { join } = require('node:path')
const { tmpdir } = require('node:os')

const { appKey, ensure, freePort, layout } = require('./state')

function scratch(name) {
    return join(tmpdir(), `acutis-${name}-${process.pid}`)
}

test('põe tudo que é gravável dentro de ~/.acutis/runtime', () => {
    const paths = layout('/home/kauan', '0.1.0')

    assert.equal(paths.root, '/home/kauan/.acutis/runtime')
    assert.equal(paths.database, '/home/kauan/.acutis/runtime/database.sqlite')
    assert.equal(paths.storage, '/home/kauan/.acutis/runtime/storage')
    assert.equal(paths.projects, '/home/kauan/.acutis')
    assert.equal(paths.app, '/home/kauan/.acutis/runtime/app/0.1.0')
})

test('cria a árvore inteira, arquivo do banco incluído', () => {
    const home = scratch('layout')
    const paths = layout(home, '0.1.0')

    ensure(paths)

    assert.ok(statSync(join(paths.storage, 'framework/views')).isDirectory())
    assert.ok(statSync(paths.logs).isDirectory())
    assert.ok(existsSync(paths.database))

    rmSync(home, { recursive: true, force: true })
})

/** Chave nova a cada boot invalidaria toda sessão e todo cookie assinado com a anterior. */
test('gera a chave da aplicação uma vez e reusa', () => {
    const home = scratch('key')
    const paths = layout(home, '0.1.0')
    ensure(paths)

    const first = appKey(paths)
    const second = appKey(paths)

    assert.ok(first.startsWith('base64:'))
    assert.equal(first, second)
    // 32 bytes em base64 dão 44 caracteres, que é o que o Laravel espera do cipher padrão.
    assert.equal(first.replace('base64:', '').length, 44)

    rmSync(home, { recursive: true, force: true })
})

test('entrega uma porta em que ninguém está escutando', async () => {
    const port = await freePort()

    assert.ok(port > 0)

    // Livre de verdade: se alguém estivesse escutando, este listen falharia.
    await new Promise((resolve, reject) => {
        const server = createServer()
        server.on('error', reject)
        server.listen(port, '127.0.0.1', () => server.close(resolve))
    })
})
