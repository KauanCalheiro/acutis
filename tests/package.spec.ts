// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

it('publica no latest, com versão semver limpa', () => {
  expect(manifest.name).toBe('@acutis/cli')
  expect(manifest.private).toBe(false)
  expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/)
  expect(manifest.publishConfig).toEqual({ access: 'public', tag: 'latest' })
  expect(manifest.scripts.release).toBe('npm publish --access public')
})

it('instala o Playwright na máquina de quem usa: o spec do projeto importa @playwright/test', () => {
  expect(manifest.dependencies['@playwright/test']).toBeDefined()
  expect(manifest.devDependencies['@playwright/test']).toBeUndefined()
})
