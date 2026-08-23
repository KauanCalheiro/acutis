import { strict as assert } from 'node:assert'
import { existsSync, lstatSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

import { ROOT } from '../project.mjs'

export const CODE = new Set(['.ts', '.mts', '.js', '.mjs', '.cjs', '.vue'])
export const TEXT = new Set([...CODE, '.md', '.css', '.html', '.json', '.yml', '.yaml'])

// As regras e skills usam travessão em tabela e nos contra-exemplos do dashes.md, então a
// configuração do Claude fica fora do guard.
const IGNORED = /(^|\/)(node_modules|\.nuxt|\.output|dist-ui|coverage|\.git)\/|^\.claude\//

/** Caminho absoluto do arquivo que a ferramenta escreveu; null quando não há arquivo. */
export function fileOf(payload) {
    const raw = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path

    return typeof raw === 'string' && raw !== '' ? resolve(ROOT, raw) : null
}

/** Caminho do arquivo relativo à raiz quando ele merece verificação; null quando não. */
export function checkable(file) {
    if (!file) return null

    const path = relative(ROOT, file)

    if (path.startsWith('..') || IGNORED.test(path) || !TEXT.has(extname(path))) return null

    // Os AGENTS.md são symlinks para as regras, já isentas acima.
    if (existsSync(file) && lstatSync(file).isSymbolicLink()) return null

    return path
}

export function test() {
    assert.equal(fileOf({ tool_input: { file_path: 'app/app.vue' } }), resolve(ROOT, 'app/app.vue'))
    assert.equal(fileOf({ tool_response: { filePath: '/tmp/x.ts' }, tool_input: {} }), '/tmp/x.ts')
    assert.equal(fileOf({}), null)

    assert.equal(checkable(resolve(ROOT, 'app/app.vue')), 'app/app.vue')
    assert.equal(checkable(resolve(ROOT, 'node_modules/x/index.js')), null)
    assert.equal(checkable(resolve(ROOT, '.claude/rules/tdd.md')), null)
    assert.equal(checkable(resolve(ROOT, 'e2e/AGENTS.md')), null)
    assert.equal(checkable(resolve(ROOT, 'app/logo.png')), null)
    assert.equal(checkable('/etc/hosts'), null)
    assert.equal(checkable(null), null)
}
