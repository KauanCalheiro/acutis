/**
 * O acutis como aplicativo de desktop.
 *
 * O app não é o produto: o produto são os três serviços que ele sobe. Este arquivo prepara o estado
 * gravável, escolhe portas, sobe os três, aponta a janela para o frontend e derruba tudo na saída.
 */
const { app, BrowserWindow } = require('electron')
const { spawn, spawnSync } = require('node:child_process')
const { existsSync, openSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const { appKey, ensure, freePort, layout } = require('./state')
const { install, killLeftovers, killTree, logTail, plan, waitUntilUp } = require('./services')

/**
 * Tempo que damos a cada serviço para responder. O backend é o mais lento no primeiro boot, porque
 * roda as migrações antes de servir.
 */
const BOOT_TIMEOUT_MS = 90_000

/** Os filhos vivos, para poder matá-los na saída. */
const running = []

function start(service, paths) {
    const log = openSync(join(paths.logs, `${service.name}.log`), 'w')

    return spawn(service.program, service.args, {
        cwd: service.cwd,
        env: { ...process.env, ...service.env },
        stdio: ['ignore', log, log],
        // Cada serviço no próprio grupo de processos: é o que permite derrubar de uma vez o filho e
        // tudo que ele abriu — o node do Playwright, por exemplo, abre navegador.
        detached: process.platform !== 'win32'
    })
}

/**
 * Prepara o banco antes de qualquer serviço subir.
 *
 * Roda em todo boot, não só no primeiro: é assim que a versão nova do app aplica as migrações que
 * vieram com ela. `migrate --force` não faz nada quando não há o que aplicar.
 */
function migrate(res, service) {
    const result = spawnSync(res.bin('php'), ['artisan', 'migrate', '--force'], {
        // O cwd do serviço é `backend/public`, que é o que o servidor embutido exige; o artisan
        // mora um nível acima.
        cwd: res.dir('backend'),
        env: { ...process.env, ...service.env }
    })

    if (result.status !== 0) {
        throw new Error(`as migrações falharam:\n${result.stderr ?? ''}`)
    }
}

/**
 * O payload empacotado, ou o que o `bundle-resources.sh` acabou de gerar.
 *
 * Empacotado, o electron-builder põe o arquivo em `resourcesPath`. Rodando por `pnpm start`, esse
 * caminho aponta para dentro do próprio Electron, onde não há payload nenhum — daí o segundo lugar,
 * que é onde o script de bundle escreve.
 */
function payloadPath() {
    const packaged = join(process.resourcesPath, 'acutis-payload.tar.gz')

    return existsSync(packaged) ? packaged : join(__dirname, '../../payload/acutis-payload.tar.gz')
}

async function boot() {
    const paths = layout(app.getPath('home'), app.getVersion())

    ensure(paths)
    killLeftovers(paths)

    const res = install(payloadPath(), paths.app)
    const key = appKey(paths)

    const ports = {
        backend: await freePort(),
        frontend: await freePort(),
        webdriver: await freePort()
    }

    const services = plan(res, paths, ports, key)

    migrate(res, services[0])

    for (const service of services) {
        running.push(start(service, paths))

        // Registrado antes do health check: se o serviço travar e o usuário matar o app na força, o
        // PID precisa estar gravado para o próximo boot poder limpá-lo.
        writeFileSync(paths.pids, running.map((child) => child.pid).join('\n'))

        if (!(await waitUntilUp(service.health, BOOT_TIMEOUT_MS))) {
            throw new Error(
                `o ${service.name} não respondeu em ${BOOT_TIMEOUT_MS / 1000}s. `
                + `Últimas linhas do log:\n\n${logTail(paths.logs, service.name, 20)}`
            )
        }
    }

    const window = new BrowserWindow({ width: 1440, height: 900, title: 'acutis' })
    await window.loadURL(`http://127.0.0.1:${ports.frontend}`)
}

/**
 * A janela que substitui a do app quando o boot falha.
 *
 * Sem isto o usuário vê o app abrir e fechar sem explicação — e o log fica num diretório que ele não
 * sabe que existe.
 */
function showFailure(message) {
    const logs = layout(app.getPath('home'), app.getVersion()).logs
    const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

    const html = `<!doctype html><meta charset="utf-8">
      <style>
        body { font: 14px ui-sans-serif, system-ui; padding: 2rem; line-height: 1.6;
               background: #18181b; color: #e4e4e7; }
        h1 { font-size: 1.1rem; margin: 0 0 1rem; }
        pre { background: #27272a; padding: 1rem; border-radius: .5rem; overflow-x: auto;
              white-space: pre-wrap; }
        p { color: #a1a1aa; }
      </style>
      <h1>O acutis não conseguiu iniciar</h1>
      <pre>${escape(message)}</pre>
      <p>Os logs completos estão em ${escape(logs)}</p>`

    const window = new BrowserWindow({ width: 760, height: 520, title: 'acutis — erro ao iniciar' })
    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
}

function shutdown() {
    // Fechar a janela não mata os filhos: sem isto ficam um php e dois node rodando, com as portas
    // presas, até o usuário reiniciar a máquina.
    for (const child of running) {
        killTree(child.pid)
    }
}

app.whenReady().then(async () => {
    try {
        await boot()
    } catch (error) {
        showFailure(error.message ?? String(error))
    }
})

app.on('window-all-closed', () => app.quit())
app.on('will-quit', shutdown)
