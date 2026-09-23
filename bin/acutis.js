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
import { homedir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { splash } from './splash.mjs'
import { ensureChromium } from './ensure-chromium.js'
import { DEFAULT_PORT, resolvePort } from './port.js'
import { serverEntryUrl } from './server-entry.js'
import { resolveTelemetryConsent } from './telemetry-consent.js'

const PACKAGE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SERVER_ENTRY = join(PACKAGE_ROOT, '.output/server/index.mjs')
const SERVER_ENTRY_URL = serverEntryUrl(PACKAGE_ROOT)

function fail(message) {
  console.error(`\x1b[31m==>\x1b[0m ${message}`)
  process.exit(1)
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

  const acutisRoot = resolve(process.env.ACUTIS_PROJECTS_PATH || join(homedir(), '.acutis'))
  const telemetryConsent = await resolveTelemetryConsent({ root: acutisRoot })

  await ensureChromium()

  const webPort = await resolvePort({ preferred: Number(process.env.PORT) || DEFAULT_PORT })
  const webUrl = `http://localhost:${webPort}`

  process.env.PORT = String(webPort)
  process.env.NITRO_PORT = String(webPort)
  process.env.HOST = '127.0.0.1'
  process.env.NITRO_HOST = '127.0.0.1'
  // Só aqui a raiz do pacote é medível: dentro do bundle do Nitro `import.meta.url` é placeholder.
  process.env.ACUTIS_PACKAGE_ROOT = PACKAGE_ROOT
  process.env.ACUTIS_TELEMETRY = telemetryConsent ? '1' : '0'
  await import(SERVER_ENTRY_URL)

  if (!await waitFor(webUrl)) fail('a aplicação não respondeu em 60s')

  console.log(splash(webUrl))
  console.log('  Ctrl+C para parar.\n')

  openBrowser(webUrl)
}

main().catch(error => fail(error instanceof Error ? error.message : String(error)))
