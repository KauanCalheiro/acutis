import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

import { ROOT } from '../project.mjs'
import { TEXT } from './target.mjs'

const EM_DASH = String.fromCharCode(8212)
const SPACED_HYPHEN = String.fromCharCode(32, 45, 32)

const EM_DASH_IN_PROSE = new RegExp(`[\\p{L}\\s]${EM_DASH}|${EM_DASH}[\\p{L}\\s]`, 'u')
const HYPHEN_IN_PROSE = new RegExp(`${SPACED_HYPHEN}\\p{L}`, 'u')

export const applies = (path) => TEXT.has(extname(path))

/** Trecho de prosa de uma linha: comentário e literais de texto, sem código. */
export function proseOf(line, markdown) {
    if (markdown) return line.replace(/^\s*(?:[-*+]|\d+\.)\s/, '')

    const comment = line.match(/(?:\/\/|\/\*|<!--|^\s*\*)\s?(.*)$/)
    const literals = [...line.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)]
        .map((match) => match[1] ?? match[2] ?? match[3])

    return [comment?.[1] ?? '', ...literals].filter(Boolean).join('\n')
}

/** Linhas do arquivo que usam travessão ou hífen cercado de espaços. */
export function violations(path, content) {
    const markdown = extname(path) === '.md'

    return content.split('\n').flatMap((line, index) => {
        const offender = EM_DASH_IN_PROSE.test(line) || HYPHEN_IN_PROSE.test(proseOf(line, markdown))

        return offender ? [`${path}:${index + 1}: ${line.trim()}`] : []
    })
}

export function check(path) {
    const found = violations(path, readFileSync(resolve(ROOT, path), 'utf8'))

    if (found.length === 0) return []

    return ['travessão ou hífen entre espaços, ver .claude/rules/dashes.md:', ...found]
}

export function test() {
    assert.equal(proseOf(`const total = alfa${SPACED_HYPHEN}beta`, false), '')
    assert.equal(proseOf(`run(a${SPACED_HYPHEN}b, "texto")`, false), 'texto')
    assert.equal(proseOf(`// o gravador para${SPACED_HYPHEN}e some`, false), `o gravador para${SPACED_HYPHEN}e some`)
    assert.equal(proseOf('- item da lista', true), 'item da lista')

    assert.deepEqual(violations('a.ts', `const x = a${SPACED_HYPHEN}b\n`), [])
    assert.equal(violations('a.ts', `const label = "para${SPACED_HYPHEN}some"\n`).length, 1)
    assert.deepEqual(violations('a.md', '- item\n'), [])
    assert.equal(violations('a.md', `texto${EM_DASH}cortado\n`).length, 1)
    assert.equal(violations('a.ts', `/** faz${SPACED_HYPHEN}isso */\n`).length, 1)
    assert.deepEqual(violations('a.vue', `<p v-if="i < items.length${SPACED_HYPHEN}1">`), [])
    assert.deepEqual(violations('a.ts', `const NOISE = '<>-_[]{}${EM_DASH}=+*'\n`), [])

    assert.ok(applies('a.md'))
    assert.ok(!applies('a.png'))
}
