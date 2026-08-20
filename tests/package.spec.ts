// @vitest-environment node
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'

const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))

it('publica somente como beta enquanto o pacote está em pré-lançamento', () => {
  expect(manifest.name).toBe('@acutis/cli')
  expect(manifest.private).toBe(false)
  expect(manifest.version).toMatch(/^\d+\.\d+\.\d+-beta\.\d+$/)
  expect(manifest.publishConfig).toEqual({ access: 'public', tag: 'beta' })
  expect(manifest.scripts['release:beta']).toContain('publish --tag beta')
})

it('instala o Playwright na máquina de quem usa: o spec do projeto importa @playwright/test', () => {
  expect(manifest.dependencies['@playwright/test']).toBeDefined()
  expect(manifest.devDependencies['@playwright/test']).toBeUndefined()
})
