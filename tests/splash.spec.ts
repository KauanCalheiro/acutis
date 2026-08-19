// @vitest-environment node
import { expect, it } from 'vitest'
import { splash } from '../bin/splash.mjs'

it('mostra um único endereço para a aplicação completa', () => {
  const url = 'http://localhost:3000'
  const output = splash(url)

  expect(output).toContain(`aplicação   ${url}`)
  expect(output.match(new RegExp(url.replaceAll('.', '\\.'), 'g'))).toHaveLength(1)
  expect(output).not.toContain('frontend')
  expect(output).not.toContain('api ')
})
