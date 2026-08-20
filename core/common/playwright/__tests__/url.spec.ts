// @vitest-environment node
/** A URL do sistema sob teste. */
import { expect, it } from 'vitest'
import { Url } from '../url.js'

it('separa host e caminho, sem a barra final', () => {
  const url = new Url('https://app.test/loja/')

  expect(url.host()).toBe('app.test')
  expect(url.path()).toBe('/loja')
  expect(url.toString()).toBe('https://app.test/loja/')
})

it('não tem caminho quando a URL é só o host', () => {
  expect(new Url('http://app.test').path()).toBe('')
})

it('recusa o que não é uma URL', () => {
  expect(() => new Url('nao-e-url')).toThrow('URL inválida: nao-e-url')
})

it('recusa protocolo que o navegador não abre', () => {
  expect(() => new Url('ftp://app.test')).toThrow('URL inválida: ftp://app.test')
})
