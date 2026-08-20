// @vitest-environment node
/** Uma execução, uma cópia do `@playwright/test`: duas e o Playwright recusa rodar o teste. */
import { mkdirSync, mkdtempSync, readlinkSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { BORROWED_NODE_MODULES, borrowNodeModules } from '../runner.service.js'

function project(): string {
  return mkdtempSync(join(tmpdir(), 'acutis-projeto-'))
}

it('empresta o nosso node_modules ao projeto que não tem nenhum', async () => {
  const dir = project()

  await borrowNodeModules(dir)

  expect(readlinkSync(join(dir, 'node_modules'))).toBe(BORROWED_NODE_MODULES)
})

it('troca o link que aponta para outra árvore', async () => {
  const dir = project()
  const outra = mkdtempSync(join(tmpdir(), 'acutis-outra-'))

  symlinkSync(outra, join(dir, 'node_modules'), 'dir')
  await borrowNodeModules(dir)

  expect(readlinkSync(join(dir, 'node_modules'))).toBe(BORROWED_NODE_MODULES)
})

it('não toca no node_modules de verdade do projeto', async () => {
  const dir = project()
  const own = join(dir, 'node_modules')

  mkdirSync(join(own, '@playwright/test'), { recursive: true })
  writeFileSync(join(own, '@playwright/test/package.json'), '{}')
  await borrowNodeModules(dir)

  expect(statSync(own).isSymbolicLink()).toBe(false)
  expect(statSync(join(own, '@playwright/test/package.json')).isFile()).toBe(true)
})
