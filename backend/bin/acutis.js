#!/usr/bin/env node
/**
 * O comando que sobe o acutis inteiro numa máquina que só tem Node.
 *
 * São dois processos: a API/gravador/runner (este mesmo, importando o `dist/main.js`) e o frontend
 * Nuxt já compilado, que vai junto no pacote. As portas são escolhidas na hora — quem instala pelo
 * npx não deve precisar saber que 3000 e 4000 existem, nem descobrir que estão ocupadas.
 *
 * Fica em JavaScript puro, sem passar pelo `tsc`, porque é o arquivo que o npm executa: um erro de
 * build aqui seria um comando que não existe.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const FRONTEND_ENTRY = join(PACKAGE_ROOT, 'frontend/server/index.mjs')

function info(message) {
    console.log(`\x1b[32m==>\x1b[0m ${message}`)
}

function fail(message) {
    console.error(`\x1b[31m==>\x1b[0m ${message}`)
    process.exit(1)
}

/** Uma porta livre de verdade: pedir a 0 ao sistema é o único jeito que não corre com ninguém. */
function freePort() {
    return new Promise((resolve, reject) => {
        const probe = createServer()

        probe.once('error', reject)
        probe.listen(0, '127.0.0.1', () => {
            const { port } = probe.address()

            probe.close(() => resolve(port))
        })
    })
}

async function waitFor(url, timeoutMs = 60_000) {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
        try {
            await fetch(url, { signal: AbortSignal.timeout(2_000) })

            return true
        } catch {
            await new Promise((resolve) => setTimeout(resolve, 300))
        }
    }

    return false
}

/**
 * O Chromium fica fora do pacote: são ~150 MB que o npm teria de baixar em toda instalação, e o
 * Playwright já guarda o dele num cache compartilhado da máquina. Baixa na primeira execução.
 */
async function ensureChromium() {
    const { chromium } = await import('playwright')

    let installed = false

    try {
        installed = existsSync(chromium.executablePath())
    } catch {
        installed = false
    }

    if (installed) return

    info('baixando o Chromium do Playwright (só na primeira execução)')

    const install = spawn(process.execPath, [join(PACKAGE_ROOT, 'node_modules/playwright/cli.js'), 'install', 'chromium'], {
        stdio: 'inherit'
    })

    const code = await new Promise((resolve) => install.on('close', resolve))

    if (code !== 0) fail('não foi possível baixar o Chromium. Rode `npx playwright install chromium` e tente de novo.')
}

function openBrowser(url) {
    const command = process.platform === 'darwin'
        ? ['open', [url]]
        : process.platform === 'win32'
            ? ['cmd', ['/c', 'start', '', url]]
            : ['xdg-open', [url]]

    // Abrir o navegador é conveniência: se a máquina não tiver como, o endereço já está na tela.
    spawn(command[0], command[1], { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
}

async function main() {
    if (!existsSync(FRONTEND_ENTRY)) {
        fail('o frontend não veio no pacote. Se você está rodando do repositório, use `pnpm cli:build` antes.')
    }

    await ensureChromium()

    const apiPort = await freePort()
    const webPort = await freePort()
    const apiUrl = `http://localhost:${apiPort}`
    const webUrl = `http://localhost:${webPort}`

    process.env.PORT = String(apiPort)
    process.env.CORS_ORIGIN = webUrl
    // Sem isto o `/runner/video` responde 403 e o vídeo da execução que falhou não abre na tela.
    process.env.WEBDRIVER_TEST_MODE = '1'

    info('subindo a api, o gravador e o runner')

    await import(join(PACKAGE_ROOT, 'dist/main.js'))

    if (!await waitFor(`${apiUrl}/health`)) fail('a api não respondeu em 60s')

    info('subindo a interface')

    const frontend = spawn(process.execPath, [FRONTEND_ENTRY], {
        stdio: ['ignore', 'ignore', 'inherit'],
        env: {
            ...process.env,
            PORT: String(webPort),
            NITRO_PORT: String(webPort),
            NUXT_API_ACUTIS_URL: apiUrl,
            NUXT_PUBLIC_WEBDRIVER_ACUTIS_URL: apiUrl
        }
    })

    const stop = () => {
        frontend.kill('SIGTERM')
        process.exit(0)
    }

    process.on('SIGINT', stop)
    process.on('SIGTERM', stop)
    frontend.on('close', (code) => fail(`a interface parou (código ${code})`))

    if (!await waitFor(webUrl)) fail('a interface não respondeu em 60s')

    console.log(`\n  acutis em ${webUrl}\n  api      em ${apiUrl}\n\n  Ctrl+C para parar.\n`)

    openBrowser(webUrl)
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)))
