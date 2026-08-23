#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, resolve } from 'node:path'

import { ROOT, git } from '../project.mjs'
import { CODE, checkable, fileOf, test as targetTest } from './target.mjs'
import * as dashes from './dashes.mjs'
import * as eslint from './eslint.mjs'
import * as vitest from './vitest.mjs'

const STAMP = resolve(ROOT, '.git/acutis-check-pending')

const CHECKS = [dashes, eslint, vitest]

function main(payload) {
    const file = fileOf(payload)
    const path = checkable(file)

    if (!path || !existsSync(file)) return

    // Marca que existe código não verificado; o finish-check roda os gates caros no Stop.
    if (CODE.has(extname(path))) writeFileSync(STAMP, path)

    const problems = CHECKS.filter(({ applies }) => applies(path)).flatMap(({ check }) => check(path))

    if (problems.length === 0) return

    console.error(problems.join('\n'))
    process.exit(2)
}

/** Varre os arquivos versionados e lista todas as violações de travessão. */
function sweep() {
    const found = (git('ls-files') ?? '').split('\n')
        .map((path) => checkable(resolve(ROOT, path)))
        .filter((path) => path && existsSync(resolve(ROOT, path)))
        .flatMap((path) => dashes.violations(path, readFileSync(resolve(ROOT, path), 'utf8')))

    console.log(found.length === 0 ? 'ok' : found.join('\n'))
    process.exitCode = found.length === 0 ? 0 : 1
}

function test() {
    for (const suite of [targetTest, dashes.test, eslint.test, vitest.test]) suite()

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
