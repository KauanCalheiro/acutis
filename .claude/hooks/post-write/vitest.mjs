import { strict as assert } from 'node:assert'
import { extname } from 'node:path'

import { pnpm } from '../project.mjs'
import { CODE } from './target.mjs'

// Os specs de `e2e/` são do Playwright, fora do include do vitest, e rodam por `pnpm test:e2e`.
export const applies = (path) => CODE.has(extname(path)) && !path.startsWith('e2e/')

/** Argumentos do vitest para o arquivo: o próprio spec, ou os testes que o alcançam. */
export function args(path) {
    return path.endsWith('.spec.ts')
        ? ['exec', 'vitest', 'run', path]
        : ['exec', 'vitest', 'related', '--run', path]
}

export function check(path) {
    // ponytail: a suíte tem estado compartilhado entre arquivos e falha fora de ordem, então só
    // reprova o que falha duas vezes; o conserto de verdade é isolar as fixtures.
    const failure = pnpm(...args(path)) && pnpm(...args(path))

    return failure ? [`teste relacionado a ${path} falhou:\n${failure}`] : []
}

export function test() {
    assert.deepEqual(args('tests/app.spec.ts'), ['exec', 'vitest', 'run', 'tests/app.spec.ts'])
    assert.deepEqual(args('app/app.vue'), ['exec', 'vitest', 'related', '--run', 'app/app.vue'])

    assert.ok(applies('app/app.vue'))
    assert.ok(!applies('e2e/tests/scenario.spec.ts'))
    assert.ok(!applies('README.md'))
}
