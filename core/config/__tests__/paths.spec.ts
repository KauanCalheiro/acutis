// @vitest-environment node
/** A raiz do pacote é o chão de tudo: reporter, gravador, vídeos e runner saem dela. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { PACKAGE_ROOT_ENV, packageRoot } from '../paths.js'

afterEach(() => {
  process.env[PACKAGE_ROOT_ENV] = ''
})

function packaged(name: string): { root: string, chunk: string } {
  const root = mkdtempSync(join(tmpdir(), 'acutis-root-'))
  const chunk = join(root, '.output/server/chunks/nitro')

  mkdirSync(chunk, { recursive: true })
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name }))
  writeFileSync(join(root, '.output/server/package.json'), JSON.stringify({ type: 'module' }))

  return { root, chunk }
}

it('acha a raiz do repositório a partir do arquivo que a pediu', () => {
  const { root, chunk } = packaged('acutis')

  expect(packageRoot([chunk])).toBe(root)
})

it('acha a raiz do pacote publicado, cujo manifesto é @acutis/cli', () => {
  const { root, chunk } = packaged('@acutis/cli')

  expect(packageRoot([chunk])).toBe(root)
})

/** No pacote publicado o bundle não sabe onde está: quem sabe é o `bin`, e ele diz pela env. */
it('prefere a raiz que o bin declarou', () => {
  const { root, chunk } = packaged('n8n')

  process.env[PACKAGE_ROOT_ENV] = root

  expect(packageRoot([chunk])).toBe(root)
})

it('ignora o manifesto de outro projeto no caminho', () => {
  const { chunk } = packaged('n8n')

  expect(packageRoot([chunk])).toBe(process.cwd())
})
