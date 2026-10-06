// @vitest-environment node
/** O `GIT_SSH_COMMAND` do clone por chave, que o git roda pelo `sh` em qualquer sistema. */
import { posix, win32 } from 'node:path'
import { expect, it } from 'vitest'
import { sshKeyCommand } from '../providers/ssh-command.js'

it('passa a chave do Windows com barra normal, que o sh não come', () => {
  expect(sshKeyCommand('C:\\Users\\kauan\\AppData\\Local\\Temp\\acutis-ssh-x\\key', win32))
    .toContain('-i "C:/Users/kauan/AppData/Local/Temp/acutis-ssh-x/key"')
})

it('passa entre aspas a chave cujo caminho tem espaço', () => {
  expect(sshKeyCommand('/Users/Kauan Morinel/tmp/acutis-ssh-x/key', posix))
    .toContain('-i "/Users/Kauan Morinel/tmp/acutis-ssh-x/key"')
})

it('usa só a chave informada e aceita o host novo sem perguntar', () => {
  expect(sshKeyCommand('/tmp/acutis-ssh-x/key', posix))
    .toBe('ssh -i "/tmp/acutis-ssh-x/key" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new')
})
