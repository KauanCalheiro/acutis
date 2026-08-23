import { strict as assert } from 'node:assert'
import { extname } from 'node:path'

import { pnpm } from '../project.mjs'
import { CODE } from './target.mjs'

export const applies = (path) => CODE.has(extname(path))

export function check(path) {
    const failure = pnpm('exec', 'eslint', '--fix', path)

    return failure ? [`eslint reprovou ${path}:\n${failure}`] : []
}

export function test() {
    assert.ok(applies('app/app.vue'))
    assert.ok(!applies('README.md'))
}
