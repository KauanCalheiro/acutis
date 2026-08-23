import { strict as assert } from 'node:assert'

import { git } from '../project.mjs'

const PROTECTED = ['main', 'master']

/** Branch em que o commit cairia; null quando o git não responde. */
export function current() {
    return git('symbolic-ref', '--short', 'HEAD')?.trim() ?? null
}

/** O commit está indo para uma branch protegida. */
export function check(branch) {
    if (!PROTECTED.includes(branch)) return []

    return [`commit straight on ${branch}: work goes in a dedicated branch, PR and squash merge`]
}

export function test() {
    assert.deepEqual(check('feat/x'), [])
    assert.deepEqual(check(null), [])
    assert.equal(check('main').length, 1)
    assert.equal(check('master').length, 1)
}
