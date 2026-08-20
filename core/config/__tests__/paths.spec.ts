// @vitest-environment node
/** A raiz do pacote é o chão de tudo: reporter, gravador, vídeos e runner saem dela. */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { packageRoot } from '../paths.js'

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

it('ignora o manifesto de outro projeto no caminho', () => {
  const { chunk } = packaged('n8n')

  expect(packageRoot([chunk])).toBe(process.cwd())
})
