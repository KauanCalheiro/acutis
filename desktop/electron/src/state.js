/**
 * Onde o app grava e em que portas ele sobe.
 *
 * O bundle é somente-leitura — `.app` assinado no macOS, Program Files no Windows —, então todo
 * estado que muda mora em `~/.acutis/runtime`. É o mesmo `~/.acutis` onde os projetos do usuário já
 * vivem, num subdiretório para não se misturar com eles.
 */
const { createServer } = require('node:net')
const { randomBytes } = require('node:crypto')
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

function layout(home, version) {
    const projects = join(home, '.acutis')
    const root = join(projects, 'runtime')

    return {
        projects,
        root,
        storage: join(root, 'storage'),
        database: join(root, 'database.sqlite'),
        appKeyFile: join(root, 'app-key'),
        logs: join(root, 'logs'),
        pids: join(root, 'pids'),
        // Por versão, para uma atualização não misturar arquivo novo com arquivo velho.
        app: join(root, 'app', version)
    }
}

/**
 * Cria o que falta. Roda em todo boot, não só no primeiro: o usuário pode apagar qualquer coisa
 * daqui entre uma execução e outra, e o Laravel não recria sozinho.
 */
function ensure(paths) {
    const dirs = [
        paths.projects,
        paths.root,
        paths.logs,
        join(paths.storage, 'framework/cache/data'),
        join(paths.storage, 'framework/sessions'),
        join(paths.storage, 'framework/views'),
        join(paths.storage, 'logs'),
        join(paths.storage, 'app/private')
    ]

    for (const dir of dirs) {
        mkdirSync(dir, { recursive: true })
    }

    if (!existsSync(paths.database)) {
        writeFileSync(paths.database, '')
    }
}

/**
 * A chave que o Laravel usa para assinar sessão e cookie.
 *
 * Nasce aqui em vez de `php artisan key:generate` porque o `.env` moraria dentro do bundle, que é
 * somente-leitura — o backend recebe a chave pelo ambiente do processo. Uma vez gerada, é reusada:
 * trocá-la a cada boot invalidaria tudo que ficou assinado com a anterior.
 */
function appKey(paths) {
    if (existsSync(paths.appKeyFile)) {
        const existing = readFileSync(paths.appKeyFile, 'utf8').trim()

        if (existing) return existing
    }

    const key = `base64:${randomBytes(32).toString('base64')}`
    writeFileSync(paths.appKeyFile, key)

    return key
}

/**
 * Uma porta que o sistema diz estar livre agora.
 *
 * Entre soltar o servidor e o serviço subir existe uma janela em que outro processo pode tomar a
 * porta. É improvável o bastante para não valer um protocolo de reserva: o serviço falha ao subir,
 * e o app mostra o erro.
 */
function freePort() {
    return new Promise((resolve, reject) => {
        const server = createServer()

        server.on('error', reject)
        server.listen(0, '127.0.0.1', () => {
            const { port } = server.address()
            server.close(() => resolve(port))
        })
    })
}

module.exports = { layout, ensure, appKey, freePort }
