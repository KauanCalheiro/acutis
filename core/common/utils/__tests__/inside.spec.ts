// @vitest-environment node
/** Se um caminho fica dentro de uma raiz, com o separador do sistema em que roda. */
import { posix, win32 } from 'node:path'
import { expect, it } from 'vitest'
import { isInside } from '../inside.js'

it('aceita o diretório dentro da raiz no posix', () => {
  expect(isInside('/home/kauan/.acutis', '/home/kauan/.acutis/plataforma', posix)).toBe(true)
})

it('aceita o diretório dentro da raiz no Windows', () => {
  expect(isInside('C:\\Users\\kauan\\.acutis', 'C:\\Users\\kauan\\.acutis\\plataforma', win32)).toBe(true)
})

it('recusa a própria raiz', () => {
  expect(isInside('/home/kauan/.acutis', '/home/kauan/.acutis', posix)).toBe(false)
})

it('recusa o caminho que sobe para fora da raiz', () => {
  expect(isInside('/home/kauan/.acutis', '/home/kauan/fora', posix)).toBe(false)
})

it('recusa o vizinho cujo nome começa com o nome da raiz', () => {
  expect(isInside('C:\\Users\\kauan\\.acutis', 'C:\\Users\\kauan\\.acutis-fora\\plataforma', win32)).toBe(false)
})

it('recusa o caminho em outro drive do Windows', () => {
  expect(isInside('C:\\Users\\kauan\\.acutis', 'D:\\plataforma', win32)).toBe(false)
})

it('aceita o diretório cujo nome começa com dois pontos', () => {
  expect(isInside('/home/kauan/.acutis', '/home/kauan/.acutis/..plataforma', posix)).toBe(true)
})
