#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { strict as assert } from 'node:assert'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, relative, resolve } from 'node:path'

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const STAMP = resolve(ROOT, '.git/acutis-check-pending')

const CODE = new Set(['.ts', '.mts', '.js', '.mjs', '.cjs', '.vue'])
const TEXT = new Set([...CODE, '.md', '.css', '.html', '.json', '.yml', '.yaml'])
// A base de memória usa travessão como separador de índice, e o dashes.md precisa dele nos
// contra-exemplos, então ela fica fora do guard.
const IGNORED = /(^|\/)(node_modules|\.nuxt|\.output|dist-ui|coverage|\.git)\/|^\.claude\/memory\//

const EM_DASH = String.fromCharCode(8212)
const SPACED_HYPHEN = String.fromCharCode(32, 45, 32)

const EM_DASH_IN_PROSE = new RegExp(`[\\p{L}\\s]${EM_DASH}|${EM_DASH}[\\p{L}\\s]`, 'u')
const HYPHEN_IN_PROSE = new RegExp(`${SPACED_HYPHEN}\\p{L}`, 'u')

/** Caminho absoluto do arquivo que a ferramenta escreveu; null quando não há arquivo. */
export function fileOf(payload) {
    const raw = payload?.tool_response?.filePath ?? payload?.tool_input?.file_path

    return typeof raw === 'string' && raw !== '' ? resolve(ROOT, raw) : null
}

/** Trecho de prosa de uma linha: comentário e literais de texto, sem código. */
export function proseOf(line, markdown) {
    if (markdown) return line.replace(/^\s*(?:[-*+]|\d+\.)\s/, '')

    const comment = line.match(/(?:\/\/|\/\*|<!--|^\s*\*)\s?(.*)$/)
    const literals = [...line.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)]
        .map((match) => match[1] ?? match[2] ?? match[3])

    return [comment?.[1] ?? '', ...literals].filter(Boolean).join('\n')
}

/** Linhas do arquivo que usam travessão ou hífen cercado de espaços. */
export function dashViolations(path, content) {
    const markdown = extname(path) === '.md'

    return content.split('\n').flatMap((line, index) => {
        const offender = EM_DASH_IN_PROSE.test(line) || HYPHEN_IN_PROSE.test(proseOf(line, markdown))

        return offender ? [`${path}:${index + 1}: ${line.trim()}`] : []
    })
}

/** Argumentos do vitest para o arquivo: o próprio spec, ou os testes que o alcançam. */
export function vitestArgs(path) {
    // Os specs de `e2e/` são do Playwright, fora do include do vitest, e rodam por `pnpm test:e2e`.
    if (path.startsWith('e2e/')) return null

    return path.endsWith('.spec.ts')
        ? ['exec', 'vitest', 'run', path]
        : ['exec', 'vitest', 'related', '--run', path]
}

/** Caminho do arquivo relativo à raiz quando ele merece verificação; null quando não. */
export function checkable(file) {
    if (!file) return null

    const path = relative(ROOT, file)

    if (path.startsWith('..') || IGNORED.test(path) || !TEXT.has(extname(path))) return null

    return path
}

/** Roda o comando no projeto e devolve o fim da saída quando ele falha. */
function run(args) {
    try {
        execFileSync('pnpm', args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })

        return null
    } catch (error) {
        return `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n')
    }
}

function main(payload) {
    const file = fileOf(payload)
    const path = checkable(file)

    if (!path || !existsSync(file)) return

    const problems = dashViolations(path, readFileSync(file, 'utf8'))

    if (problems.length > 0) {
        problems.unshift('travessão ou hífen entre espaços, ver .claude/memory/dashes.md:')
    }

    if (CODE.has(extname(path))) {
        writeFileSync(STAMP, path)

        const lint = run(['exec', 'eslint', '--fix', path])

        if (lint) problems.push(`eslint reprovou ${path}:\n${lint}`)

        // ponytail: a suíte tem estado compartilhado entre arquivos e falha fora de ordem, então só
        // reprova o que falha duas vezes; o conserto de verdade é isolar as fixtures.
        const args = vitestArgs(path)
        const tests = args && run(args) && run(args)

        if (tests) problems.push(`teste relacionado a ${path} falhou:\n${tests}`)
    }

    if (problems.length === 0) return

    console.error(problems.join('\n'))
    process.exit(2)
}

/** Varre os arquivos versionados e lista todas as violações de travessão. */
function sweep() {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n')
    const found = tracked
        .map((path) => checkable(resolve(ROOT, path)))
        .filter((path) => path && existsSync(resolve(ROOT, path)))
        .flatMap((path) => dashViolations(path, readFileSync(resolve(ROOT, path), 'utf8')))

    console.log(found.length === 0 ? 'ok' : found.join('\n'))
    process.exitCode = found.length === 0 ? 0 : 1
}

function test() {
    assert.equal(fileOf({ tool_input: { file_path: 'app/app.vue' } }), resolve(ROOT, 'app/app.vue'))
    assert.equal(fileOf({ tool_response: { filePath: '/tmp/x.ts' }, tool_input: {} }), '/tmp/x.ts')
    assert.equal(fileOf({}), null)

    assert.equal(proseOf(`const total = alfa${SPACED_HYPHEN}beta`, false), '')
    assert.equal(proseOf(`run(a${SPACED_HYPHEN}b, "texto")`, false), 'texto')
    assert.equal(proseOf(`// o gravador para${SPACED_HYPHEN}e some`, false), `o gravador para${SPACED_HYPHEN}e some`)
    assert.equal(proseOf('- item da lista', true), 'item da lista')

    assert.deepEqual(dashViolations('a.ts', `const x = a${SPACED_HYPHEN}b\n`), [])
    assert.equal(dashViolations('a.ts', `const label = "para${SPACED_HYPHEN}some"\n`).length, 1)
    assert.deepEqual(dashViolations('a.md', '- item\n'), [])
    assert.equal(dashViolations('a.md', `texto${EM_DASH}cortado\n`).length, 1)
    assert.equal(dashViolations('a.ts', `/** faz${SPACED_HYPHEN}isso */\n`).length, 1)
    assert.deepEqual(dashViolations('a.vue', `<p v-if="i < items.length${SPACED_HYPHEN}1">`), [])
    assert.deepEqual(dashViolations('a.ts', `const NOISE = '<>-_[]{}${EM_DASH}=+*'\n`), [])

    assert.deepEqual(vitestArgs('tests/app.spec.ts'), ['exec', 'vitest', 'run', 'tests/app.spec.ts'])
    assert.deepEqual(vitestArgs('app/app.vue'), ['exec', 'vitest', 'related', '--run', 'app/app.vue'])
    assert.equal(vitestArgs('e2e/tests/scenario.spec.ts'), null)

    assert.equal(checkable(resolve(ROOT, 'app/app.vue')), 'app/app.vue')
    assert.equal(checkable(resolve(ROOT, 'node_modules/x/index.js')), null)
    assert.equal(checkable(resolve(ROOT, '.claude/memory/tdd.md')), null)
    assert.equal(checkable(resolve(ROOT, 'app/logo.png')), null)
    assert.equal(checkable('/etc/hosts'), null)
    assert.equal(checkable(null), null)

    console.log('ok')
}

if (process.argv[2] === '--test') {
    test()
} else if (process.argv[2] === '--sweep') {
    sweep()
} else {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    main(JSON.parse(Buffer.concat(chunks).toString() || '{}'))
}
