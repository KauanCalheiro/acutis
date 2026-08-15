/**
 * Os três serviços do acutis rodando como processos filhos do app.
 *
 * Nada aqui fala com o usuário: monta comando, sobe, espera responder. Quem traduz falha em janela
 * de erro é o `main.js`.
 */
const { execFileSync, spawn, spawnSync } = require('node:child_process')
const { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const EXE = process.platform === 'win32' ? '.exe' : ''

/** Onde estão os recursos que viajaram no bundle — já extraídos, fora dele. */
function resources(root) {
    return {
        root,
        bin: (name) => join(root, `${name}${EXE}`),
        dir: (name) => join(root, name),

        /**
         * O CLI do Playwright é um .js: quem o executa é o node que veio junto, porque no bundle
         * não existe outro.
         */
        playwrightCli: () => join(root, 'webdriver/node_modules/playwright/cli.js'),

        /**
         * O git só viaja no bundle onde o sistema costuma não ter. Nos demais vale o do PATH — e é
         * o que permite ao clone usar as chaves e o credential helper que o usuário já configurou.
         */
        gitBin: () => {
            const bundled = join(root, 'git/cmd/git.exe')

            return existsSync(bundled) ? bundled : 'git'
        }
    }
}

/**
 * Extrai o payload, se ainda não estiver extraído para esta versão.
 *
 * O bundle carrega um .tar.gz em vez dos arquivos soltos porque o empacotador copia conteúdo sem
 * garantir symlink: o node_modules perderia os pacotes e o Chrome for Testing perderia os links
 * internos do .framework, sem os quais não abre.
 *
 * Quem extrai é o `tar` do sistema — presente no macOS, no Linux e no Windows 10 build 17063+.
 * Evita uma dependência só para desempacotar, e é o mesmo formato que o `bundle-resources.sh` gera.
 *
 * ponytail: extração síncrona antes da janela aparecer — no primeiro boot são alguns minutos de
 * silêncio. Se incomodar, o caminho é uma janela de progresso lendo a saída do `tar -v`.
 */
function install(payload, into) {
    const done = join(into, '.installed')

    if (existsSync(done)) return resources(into)

    // Extração interrompida deixa lixo pela metade; começar do zero é mais barato que descobrir o
    // que faltou.
    if (existsSync(into)) rmSync(into, { recursive: true, force: true })

    mkdirSync(into, { recursive: true })
    execFileSync('tar', ['xzf', payload, '-C', into])
    writeFileSync(done, '')

    return resources(into)
}

/**
 * Os três serviços, já com as URLs cruzadas.
 *
 * Tudo escuta em 127.0.0.1: isto é um app de desktop, não um servidor — abrir na rede exporia os
 * projetos do usuário para a máquina inteira.
 */
function plan(res, paths, ports, key) {
    const backendUrl = `http://127.0.0.1:${ports.backend}`
    const frontendUrl = `http://127.0.0.1:${ports.frontend}`
    const webdriverUrl = `http://127.0.0.1:${ports.webdriver}`

    const backendEnv = {
        APP_KEY: key,
        APP_ENV: 'production',
        APP_DEBUG: 'false',
        // Lida do ambiente do processo, antes do .env — é por isso que vem daqui e não de um
        // arquivo. Sem ela o Laravel tentaria escrever dentro do bundle, que é somente-leitura.
        LARAVEL_STORAGE_PATH: paths.storage,
        DB_CONNECTION: 'sqlite',
        DB_DATABASE: paths.database,
        ACUTIS_PROJECTS_PATH: paths.projects,
        WEBDRIVER_URL: webdriverUrl,
        ACUTIS_GIT_BIN: res.gitBin(),
        // Sem isto o Laravel guardaria sessão e cache em arquivo dentro do bundle.
        SESSION_DRIVER: 'database',
        CACHE_STORE: 'database'
    }

    return [
        {
            name: 'backend',
            program: res.bin('php'),
            // O servidor embutido é chamado direto, e não por `artisan serve`, porque o artisan é
            // só um pai que dá spawn neste mesmo comando: sobrando um processo a mais para a saída
            // do app ter que alcançar. O `server.php` é o mesmo roteador que o artisan usaria, e
            // lê o diretório público do cwd — daí o cwd ser `backend/public`.
            args: [
                '-S',
                `127.0.0.1:${ports.backend}`,
                '../vendor/laravel/framework/src/Illuminate/Foundation/resources/server.php'
            ],
            cwd: join(res.dir('backend'), 'public'),
            env: backendEnv,
            health: `${backendUrl}/up`
        },
        {
            name: 'webdriver',
            program: res.bin('node'),
            args: ['dist/main.js'],
            cwd: res.dir('webdriver'),
            env: {
                PORT: String(ports.webdriver),
                CORS_ORIGIN: frontendUrl,
                // Sem isto os endpoints /runner/* respondem 403 e o botão "Testar" não funciona.
                WEBDRIVER_TEST_MODE: '1',
                PLAYWRIGHT_BROWSERS_PATH: res.dir('browsers'),
                ACUTIS_PLAYWRIGHT_CLI: res.playwrightCli(),
                // Vazia de propósito: é o que faz o gravador abrir o próprio Chromium em vez de
                // procurar um Chrome com porta de debug, atrito que só existe no container.
                RECORDER_CDP_URL: ''
            },
            health: `${webdriverUrl}/health`
        },
        {
            name: 'frontend',
            program: res.bin('node'),
            args: ['.output/server/index.mjs'],
            cwd: res.dir('frontend'),
            env: {
                NITRO_PORT: String(ports.frontend),
                NITRO_HOST: '127.0.0.1',
                NUXT_API_ACUTIS_URL: backendUrl,
                NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL: webdriverUrl
            },
            health: frontendUrl
        }
    ]
}

/**
 * Espera um endereço responder qualquer coisa que não seja "conexão recusada".
 *
 * Não olha o código HTTP: um 404 já prova que há alguém escutando, e é tudo que interessa aqui.
 */
async function waitUntilUp(url, timeoutMs) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        try {
            await fetch(url, { signal: AbortSignal.timeout(2000) })

            return true
        } catch {
            await new Promise((r) => setTimeout(r, 250))
        }
    }

    return false
}

/**
 * Mata o processo e tudo que ele tenha aberto.
 *
 * Matar só o PID não basta: o node do Playwright abre navegador, e o que sobra fica com porta presa
 * e memória ocupada depois que o usuário fechou a janela.
 */
function killTree(pid) {
    if (process.platform === 'win32') {
        spawnSync('taskkill', ['/T', '/F', '/PID', String(pid)])

        return
    }

    // O filho foi posto no próprio grupo (ver `start`), então o alvo negativo alcança ele e todos
    // os netos de uma vez.
    try {
        process.kill(-pid, 'SIGTERM')
    } catch {
        // já morreu
    }
}

/** Se o processo com este PID é um dos nossos, e não um estranho que herdou o número. */
function isOurs(pid, appDir) {
    const probe = process.platform === 'win32'
        ? spawnSync('wmic', ['process', 'where', `ProcessId=${pid}`, 'get', 'ExecutablePath'])
        : spawnSync('ps', ['-o', 'command=', '-p', String(pid)])

    return String(probe.stdout ?? '').includes(appDir)
}

/**
 * Derruba o que sobrou de uma execução anterior que não passou pelo encerramento normal — crash,
 * force quit, `kill -9`.
 *
 * Sem isto o usuário acumula um php e dois node a cada vez que o app morre torto, cada um segurando
 * porta e memória até ele reiniciar a máquina.
 */
function killLeftovers(paths) {
    if (!existsSync(paths.pids)) return

    for (const line of readFileSync(paths.pids, 'utf8').split('\n')) {
        const pid = Number(line.trim())

        if (pid && isOurs(pid, paths.app)) killTree(pid)
    }

    rmSync(paths.pids, { force: true })
}

/** As últimas linhas do log de um serviço, para a janela de erro dizer o que houve. */
function logTail(logs, name, lines) {
    try {
        return readFileSync(join(logs, `${name}.log`), 'utf8').split('\n').slice(-lines).join('\n')
    } catch {
        return ''
    }
}

module.exports = {
    resources,
    install,
    plan,
    waitUntilUp,
    killTree,
    killLeftovers,
    isOurs,
    logTail
}
