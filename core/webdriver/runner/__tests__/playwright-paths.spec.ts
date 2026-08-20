// @vitest-environment node
/** O runner precisa achar o Playwright sem npx e sem PATH: o pacote publicado não tem nem um nem outro. */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { BORROWED_NODE_MODULES, PLAYWRIGHT_CLI } from '../runner.service.js'

it('resolve o cli do Playwright por módulo, não pelo shim do .bin', () => {
  expect(existsSync(PLAYWRIGHT_CLI)).toBe(true)
})

it('resolve fora do .output, onde o Nitro deixa stubs no lugar das dependências', () => {
  expect(PLAYWRIGHT_CLI).not.toContain('.output')
  expect(BORROWED_NODE_MODULES).not.toContain('.output')
})

it('empresta ao projeto sob teste um node_modules que tem o @playwright/test', () => {
  expect(existsSync(join(BORROWED_NODE_MODULES, '@playwright/test'))).toBe(true)
})
