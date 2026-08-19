// @vitest-environment node
import { expect, it } from 'vitest'
import { tokenUrl } from '../providers/clone-url.js'

it('embute o token numa url https', () => {
  expect(tokenUrl('https://github.com/acme/app.git', 'abc123'))
    .toBe('https://abc123@github.com/acme/app.git')
})

it('codifica o token para a url', () => {
  expect(tokenUrl('https://gitlab.com/x/y.git', 'a b/c'))
    .toBe('https://a%20b%2Fc@gitlab.com/x/y.git')
})
