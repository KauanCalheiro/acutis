#!/usr/bin/env node
/**
 * O comando que sobe o acutis inteiro numa máquina que só tem Node.
 *
 * O Nitro serve interface, API, gravador e runner no mesmo processo e numa porta livre.
 *
 * Fica em JavaScript puro, sem passar pelo `tsc`, porque é o arquivo que o npm executa: um erro de
 * build aqui seria um comando que não existe.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createServer } from 'node:net'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { splash } from './splash.mjs'
import { ensureChromium } from './ensure-chromium.js'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_ENTRY = join(PACKAGE_ROOT, '.output/server/index.mjs')

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
      await new Promise(resolve => setTimeout(resolve, 300))
    }
  }

  return false
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
  if (!existsSync(SERVER_ENTRY)) {
    fail('a aplicação não veio no pacote. Se você está rodando do repositório, use `pnpm cli:build` antes.')
  }

  await ensureChromium()

  const webPort = await freePort()
  const webUrl = `http://localhost:${webPort}`

  process.env.PORT = String(webPort)
  process.env.NITRO_PORT = String(webPort)
  process.env.HOST = '127.0.0.1'
  process.env.NITRO_HOST = '127.0.0.1'
  await import(SERVER_ENTRY)

  if (!await waitFor(webUrl)) fail('a aplicação não respondeu em 60s')

  console.log(splash(webUrl))
  console.log('  Ctrl+C para parar.\n')

  openBrowser(webUrl)
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)))
