import { execFileSync } from 'node:child_process'
import { strict as assert } from 'node:assert'

export const ROOT = process.env.CLAUDE_PROJECT_DIR ?? process.cwd()

/** Fim da saída do comando quando ele falha; null quando passa. */
function output(command, args) {
    try {
        execFileSync(command, args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })

        return null
    } catch (error) {
        return `${error.stdout ?? ''}${error.stderr ?? ''}`.trim().split('\n').slice(-40).join('\n')
    }
}

/** Roda o pnpm na raiz do projeto. */
export function pnpm(...args) {
    return output('pnpm', args)
}

/** Saída do git na raiz do projeto; null quando o comando falha. */
export function git(...args) {
    try {
        return execFileSync('git', args, { cwd: ROOT, stdio: 'pipe', encoding: 'utf8' })
    } catch {
        return null
    }
}

export function test() {
    assert.equal(pnpm('lint'), null)
    assert.ok(pnpm('nao-existe-esse-script'))
    assert.ok(git('rev-parse', '--git-dir'))
    assert.equal(git('nao-existe-esse-comando'), null)
}
