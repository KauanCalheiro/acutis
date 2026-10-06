/** O `GIT_SSH_COMMAND` que clona com a chave guardada em `keyFile`. */
import nodePath from 'node:path'
import { toPosixPath } from '../../../common/utils/posix-path.js'

export function sshKeyCommand(keyFile: string, paths: typeof nodePath = nodePath): string {
  return `ssh -i "${toPosixPath(keyFile, paths)}" -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`
}
