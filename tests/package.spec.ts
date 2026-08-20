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

/** `postinstall` roda na máquina de quem instala e o pnpm o bloqueia até alguém aprovar. */
it('não roda script nenhum na instalação de quem usa o CLI', () => {
  expect(manifest.scripts.postinstall).toBeUndefined()
  expect(manifest.scripts.install).toBeUndefined()
  expect(manifest.scripts.prepare).toBe('nuxt prepare')
})

/** Nuxt e Nuxt UI constroem o `.output`; na máquina de quem usa só arrastariam scripts de build. */
it('não instala o que só serve para construir o pacote', () => {
  for (const build of ['nuxt', '@nuxt/ui', '@iconify-json/ic', '@medv/finder']) {
    expect(manifest.dependencies[build]).toBeUndefined()
    expect(manifest.devDependencies[build]).toBeDefined()
  }
})

it('instala o Playwright na máquina de quem usa: o spec do projeto importa @playwright/test', () => {
  expect(manifest.dependencies['@playwright/test']).toBeDefined()
  expect(manifest.devDependencies['@playwright/test']).toBeUndefined()
})
