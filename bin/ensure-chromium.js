#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

async function playwrightExecutablePath() {
  const { chromium } = await import('playwright')

  return chromium.executablePath()
}

function installChromium() {
  const playwrightRoot = dirname(require.resolve('playwright/package.json'))
  const child = spawn(process.execPath, [join(playwrightRoot, 'cli.js'), 'install', 'chromium'], {
    stdio: 'inherit'
  })

  return new Promise((resolvePromise, reject) => {
    child.once('error', reject)
    child.once('close', code => resolvePromise(code ?? 1))
  })
}

function info(message) {
  console.log(`\x1b[32m==>\x1b[0m ${message}`)
}

/** Garante que o Chromium esperado pela versão instalada do Playwright está disponível. */
export async function ensureChromium({
  executablePath = playwrightExecutablePath,
  exists = existsSync,
  install = installChromium,
  log = info
} = {}) {
  const browserPath = await Promise.resolve().then(executablePath).catch(() => '')

  if (browserPath !== '' && exists(browserPath)) return false

  log('baixando o Chromium do Playwright (só na primeira execução)')

  if (await install() !== 0) {
    throw new Error('não foi possível baixar o Chromium. Rode `npx playwright install chromium` e tente de novo.')
  }

  return true
}

const invokedFile = process.argv[1] ? resolve(process.argv[1]) : ''

if (invokedFile === fileURLToPath(import.meta.url)) {
  ensureChromium().catch((error) => {
    console.error(`\x1b[31m==>\x1b[0m ${error instanceof Error ? error.message : String(error)}`)
    process.exitCode = 1
  })
}
