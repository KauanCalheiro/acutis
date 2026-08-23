#!/usr/bin/env node
import * as branch from './branch.mjs'
import * as command from './command.mjs'
import * as message from './message.mjs'

function main(input) {
    const bash = input?.tool_input?.command ?? ''

    if (!command.isCommit(bash)) return

    const found = [
        ...branch.check(branch.current()),
        ...message.check(command.messageOf(bash)),
    ]

    if (found.length === 0) return

    console.log(JSON.stringify({
        continue: true,
        hookSpecificOutput: {
            hookEventName: 'PreToolUse',
            permissionDecision: 'deny',
            permissionDecisionReason: `Commit outside the standard in .claude/rules/git.md:\n- ${found.join('\n- ')}\nFix the command and run it again.`,
        },
    }))
}

function test() {
    for (const suite of [command.test, message.test, branch.test]) suite()

    console.log('ok')
}

if (process.argv[2] === '--test') {
    test()
} else {
    const chunks = []
    for await (const chunk of process.stdin) chunks.push(chunk)
    main(JSON.parse(Buffer.concat(chunks).toString() || '{}'))
}
