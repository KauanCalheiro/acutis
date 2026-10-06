// @vitest-environment node
/** O caminho relativo com barra normal, que é o que spec, import e id de cenário esperam. */
import { posix, win32 } from 'node:path'
import { expect, it } from 'vitest'
import { toPosixPath } from '../posix-path.js'

it('troca a barra invertida do Windows pela barra normal', () => {
  expect(toPosixPath('tests\\loja\\comprar.spec.ts', win32)).toBe('tests/loja/comprar.spec.ts')
})

it('mantém o caminho que já está no formato posix', () => {
  expect(toPosixPath('tests/loja/comprar.spec.ts', posix)).toBe('tests/loja/comprar.spec.ts')
})
