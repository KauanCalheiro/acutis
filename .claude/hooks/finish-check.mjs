#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { strict as assert } from 'node:assert'
import { existsSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()
const STAMP = resolve(ROOT, '.git/acutis-check-pending')

const GATES = [
    { name: 'typecheck', script: 'typecheck' },
    { name: 'suíte com cobertura', script: 'test:coverage' },
    { name: 'código duplicado', script: 'dup' }
]

/** Fim da saída do script quando ele falha; null quando passa. */
export function runGate(script) {
    try {
        execFileSync('pnpm', [script], { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })

        return null
    } catch (error) {
        return `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n')
    }
}

/** Mensagem para o modelo quando algum gate reprova; null quando tudo passa. */
export function report(failures) {
    if (failures.length === 0) return null

    return failures.map(({ name, output }) => `${name} reprovou:\n${output}`).join('\n\n')
}

function main(payload) {
    if (!existsSync(STAMP)) return

    // ponytail: repete o gate que falha, pela mesma flakiness de ordem da suíte.
    const failures = GATES
        .map(({ name, script }) => ({ name, output: runGate(script) && runGate(script) }))
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
    assert.equal(runGate('lint'), null)

    console.log('ok')
}

if (process.argv[2] === '--test') {
    test()
} else {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    main(JSON.parse(Buffer.concat(chunks).toString() || '{}'))
}
