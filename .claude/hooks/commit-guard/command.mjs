import { strict as assert } from 'node:assert'

/** O comando do Bash é um `git commit`, mesmo encadeado com `&&`, `||` ou `;`. */
export function isCommit(command) {
    return command
        .split(/&&|\|\||;/)
        .some((link) => /^\s*(?:\w+=\S+\s+)*git\b(?:\s+-\S+|\s+--\S+)*\s+commit\b/.test(link))
}

/** Mensagem que o comando passa, por `-m` ou por heredoc; null quando ele não traz mensagem. */
export function messageOf(command) {
    const heredoc = command.match(/<<-?\s*'?"?(\w+)'?"?\r?\n([\s\S]*?)\r?\n\1\b/)

    if (heredoc) return heredoc[2]

    const inline = command.match(/(?:^|\s)(?:-[a-zA-Z]*m|--message=?)\s*(["'])([\s\S]*?)\1/)

    return inline ? inline[2] : null
}

export function test() {
    assert.ok(isCommit('git commit -m "feat: x"'))
    assert.ok(isCommit('git add -A && git commit -q -m "feat: x"'))
    assert.ok(!isCommit('git log --format=%s -1'))

    assert.equal(messageOf('git commit -m "feat: x"'), 'feat: x')
    assert.equal(messageOf("git commit -am 'fix: y'"), 'fix: y')
    assert.equal(messageOf('git commit -F - <<\'EOF\'\nfeat: z\nEOF'), 'feat: z')
    assert.equal(messageOf('git commit --amend --no-edit'), null)
}
