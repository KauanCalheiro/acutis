import { strict as assert } from 'node:assert'

const PREFIXES = ['feat', 'fix', 'refactor', 'chore', 'docs', 'test', 'style']

/** O que a mensagem quebra do padrão; vazio quando ela está de acordo. */
export function check(message) {
    if (message === null) return []

    const found = []
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

export function test() {
    const clean = (message) => assert.deepEqual(check(message), [])
    const dirty = (message) => assert.ok(check(message).length > 0, message)

    clean('feat: reject commits that break the standard')
    clean('test: cover the commit guard')
    clean(null)

    dirty('adiciona hook sem prefixo')
    dirty('feat: record the hover and emit the spec')
    dirty(`feat: record the hover${String.fromCharCode(32, 45, 32)}it was noisy`)
    dirty(`feat: record the hover${String.fromCharCode(8212)}it was noisy`)
    dirty('feat: keep the trail\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>')
    dirty('feat: keep the trail\n\nexplains in a body the standard does not take')
    dirty(`feat: ${'x'.repeat(80)}`)
}
