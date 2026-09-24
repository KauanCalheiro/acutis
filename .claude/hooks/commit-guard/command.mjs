import { strict as assert } from 'node:assert'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** O comando do Bash é um `git commit`, mesmo encadeado com `&&`, `||` ou `;`. */
export function isCommit(command) {
    return command
        .split(/&&|\|\||;/)
        .some((link) => /^\s*(?:\w+=\S+\s+)*git\b(?:\s+-\S+|\s+--\S+)*\s+commit\b/.test(link))
}

/** O conteúdo do arquivo de `-F` ou `--file`; null quando o comando não aponta um arquivo legível. */
function fileMessage(command) {
    const file = command.match(/(?:^|\s)(?:-F|--file)(?:=|\s+)(["']?)([^\s"']+)\1/)

    if (!file || file[2] === '-') return null

    try {
        return readFileSync(file[2], 'utf8')
    } catch {
        return null
    }
}

/** Mensagem que o comando passa, por `-m`, heredoc ou arquivo; null quando ele não traz mensagem. */
export function messageOf(command) {
    const heredoc = command.match(/<<-?\s*'?"?(\w+)'?"?\r?\n([\s\S]*?)\r?\n\1\b/)

    if (heredoc) return heredoc[2]

    const inline = [...command.matchAll(/(?:^|\s)(?:-[a-zA-Z]*m|--message=?)\s*(["'])([\s\S]*?)\1/g)]

    if (inline.length > 0) return inline.map((match) => match[2]).join('\n\n')

    return fileMessage(command)
}

export function test() {
    assert.ok(isCommit('git commit -m "feat: x"'))
    assert.ok(isCommit('git add -A && git commit -q -m "feat: x"'))
    assert.ok(!isCommit('git log --format=%s -1'))

    assert.equal(messageOf('git commit -m "feat: x"'), 'feat: x')
    assert.equal(messageOf("git commit -am 'fix: y'"), 'fix: y')
    assert.equal(messageOf('git commit -F - <<\'EOF\'\nfeat: z\nEOF'), 'feat: z')
    assert.equal(messageOf('git commit --amend --no-edit'), null)

    assert.equal(messageOf('git commit -m "feat: x" -m "Co-Authored-By: C"'), 'feat: x\n\nCo-Authored-By: C')

    const dir = mkdtempSync(join(tmpdir(), 'commit-guard-'))
    const file = join(dir, 'msg.txt')
    writeFileSync(file, 'feat: w\n\nCo-Authored-By: C\n')

    try {
        assert.equal(messageOf(`git commit -F ${file}`), 'feat: w\n\nCo-Authored-By: C\n')
        assert.equal(messageOf(`git commit --file=${file}`), 'feat: w\n\nCo-Authored-By: C\n')
        assert.equal(messageOf(`git commit --file ${file}`), 'feat: w\n\nCo-Authored-By: C\n')
        assert.equal(messageOf(`git commit -F ${join(dir, 'nao-existe.txt')}`), null)
    } finally {
        rmSync(dir, { recursive: true, force: true })
    }
}
