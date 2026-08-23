#!/usr/bin/env node
import { strict as assert } from 'node:assert'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

import { ROOT, test as projectTest } from '../project.mjs'
import * as typecheck from './typecheck.mjs'
import * as coverage from './coverage.mjs'
import * as duplication from './duplication.mjs'

const STAMP = resolve(ROOT, '.git/acutis-check-pending')

const GATES = [typecheck, coverage, duplication]

/** Mensagem para o modelo quando algum gate reprova; null quando tudo passa. */
export function report(failures) {
    if (failures.length === 0) return null

    return failures.map(({ name, output }) => `${name} reprovou:\n${output}`).join('\n\n')
}

function main(payload) {
    if (!existsSync(STAMP)) return

    const failures = GATES
        .map(({ name, check }) => ({ name, output: check() }))
        .filter(({ output }) => output !== null)

    const problems = report(failures)

    if (!problems) {
        rmSync(STAMP)
        console.log(JSON.stringify({ systemMessage: 'typecheck, cobertura e duplicação: tudo verde' }))

        return
    }

    if (payload?.stop_hook_active) {
        console.log(JSON.stringify({ systemMessage: `Verificação segue vermelha:\n${problems}` }))

        return
    }

    console.error(problems)
    process.exit(2)
}

function test() {
    assert.equal(report([]), null)
    assert.equal(report([{ name: 'typecheck', output: 'erro x' }]), 'typecheck reprovou:\nerro x')
    assert.deepEqual(GATES.map(({ name }) => name), ['typecheck', 'suíte com cobertura', 'código duplicado'])

    projectTest()

    console.log('ok')
}

if (process.argv[2] === '--test') {
    test()
} else {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    main(JSON.parse(Buffer.concat(chunks).toString() || '{}'))
}
