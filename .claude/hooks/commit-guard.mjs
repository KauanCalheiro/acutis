#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { strict as assert } from 'node:assert'

const PREFIXES = ['feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'style']

export function isCommit(command) {
    return command
        .split(/&&|\|\||;/)
        .some((link) => /^\s*(?:\w+=\S+\s+)*git\b(?:\s+-\S+|\s+--\S+)*\s+commit\b/.test(link))
}

export function messageOf(command) {
    const heredoc = command.match(/<<-?\s*'?"?(\w+)'?"?\r?\n([\s\S]*?)\r?\n\1\b/)

    if (heredoc) return heredoc[2]

    const inline = command.match(/(?:^|\s)(?:-[a-zA-Z]*m|--message=?)\s*(["'])([\s\S]*?)\1/)

    return inline ? inline[2] : null
}

export function violations(message, branch) {
    const found = []

    if (branch === 'main' || branch === 'master') {
        found.push(`commit straight on ${branch}: work goes in a dedicated branch, PR and squash merge`)
    }

    if (message === null) return found

    const lines = message.split('\n').filter((line) => line.trim() !== '')
    const [subject = '', ...body] = lines

    if (!PREFIXES.some((prefix) => subject.startsWith(`${prefix}: `))) {
        found.push(`subject without a semantic prefix: use ${PREFIXES.join('|')} followed by a colon`)
    }

    if (subject.length > 72) found.push(`subject is ${subject.length} characters long, the cap is 72`)
    if (body.length > 0) found.push('a commit is a single line, with no body')
    if (/^Co-Authored-By:/im.test(message)) found.push('no Claude co-author in the history')
    if (/ (and|e|&) /.test(subject)) found.push('conjunction in the subject: two things done are two commits')
    if (/ - |—/.test(subject)) found.push('no spaced hyphen and no em dash, use the punctuation the sentence asks for')

    return found
}

function branchOf(cwd) {
    try {
        return execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd, encoding: 'utf8' }).trim()
    } catch {
        return null
    }
}

function main(input) {
    const command = input?.tool_input?.command ?? ''

    if (!isCommit(command)) return

    const found = violations(messageOf(command), branchOf(input?.cwd ?? process.cwd()))

    if (found.length === 0) return

    console.log(JSON.stringify({
        continue: true,
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `Commit outside the standard in .claude/memory/commit.md:\n- ${found.join('\n- ')}\nFix the command and run it again.`,
        },
    }))
}

function test() {
    const clean = (message) => assert.deepEqual(violations(message, 'feat/x'), [])
    const dirty = (message) => assert.ok(violations(message, 'feat/x').length > 0, message)

    assert.ok(isCommit('git commit -m "feat: x"'))
    assert.ok(isCommit('git add -A && git commit -q -m "feat: x"'))
    assert.ok(!isCommit('git log --format=%s -1'))
    assert.equal(messageOf('git commit -m "feat: x"'), 'feat: x')
    assert.equal(messageOf("git commit -am 'fix: y'"), 'fix: y')
    assert.equal(messageOf('git commit -F - <<\'EOF\'\nfeat: z\nEOF'), 'feat: z')
    assert.equal(messageOf('git commit --amend --no-edit'), null)

    clean('feat: reject commits that break the standard')
    clean('test: cover the commit guard')
    dirty('adiciona hook sem prefixo')
    dirty('feat: record the hover and emit the spec')
    dirty('feat: record the hover - it was noisy')
    dirty('feat: record the hover — it was noisy')
    dirty('feat: keep the trail\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')
    dirty('feat: keep the trail\n\nexplains in a body the standard does not take')
    dirty(`feat: ${'x'.repeat(80)}`)
    assert.equal(violations(null, 'main').length, 1)

    console.log('ok')
}

if (process.argv[2] === '--test') {
    test()
} else {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    main(JSON.parse(Buffer.concat(chunks).toString() || '{}'))
}
