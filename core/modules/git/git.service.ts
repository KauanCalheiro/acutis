/**
 * O que o acutis faz com repositórios: sondar se dá para acessar e clonar para dentro da pasta de
 * projetos, por repositório público, token ou chave SSH.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { BadRequest } from '../../common/exceptions/errors.js'
import { tokenUrl } from './providers/clone-url.js'
import { Git } from './providers/git.js'

/** O ambiente que impede o git de travar pedindo credencial num processo sem terminal. */
const NON_INTERACTIVE = {
  GIT_TERMINAL_PROMPT: '0',
  GIT_SSH_COMMAND: 'ssh -o BatchMode=yes -o StrictHostKeyChecking=accept-new'
}

export type CloneAuth = 'public' | 'token' | 'ssh_key'

export interface CloneRequest {
  url: string
  name?: string
  branch?: string
  auth?: CloneAuth
  token?: string
  ssh_key?: string
}

export class GitService {
  /** Se o repositório responde sem pedir credencial. */
  async probe(url: string): Promise<boolean> {
    try {
      await Git.client(process.cwd(), NON_INTERACTIVE).listRemote([url])

      return true
    } catch {
      return false
    }
  }

  /**
     * Clona para `path` pela forma de acesso escolhida. O token sai do remote depois do clone, e a
     * chave SSH vira arquivo temporário apagado ao fim.
     */
  async clone(request: CloneRequest, path: string): Promise<void> {
    const auth = request.auth ?? 'public'

    let url = request.url
    let cleanUrl: string | null = null
    let env: Record<string, string> = {}
    let keyFile: string | null = null

    if (auth === 'token' && request.token) {
      url = tokenUrl(request.url, request.token)
      cleanUrl = request.url
    }

    if (auth === 'ssh_key' && request.ssh_key) {
      keyFile = join(mkdtempSync(join(tmpdir(), 'acutis-ssh-')), 'key')
      writeFileSync(keyFile, `${request.ssh_key.trimEnd()}\n`, { mode: 0o600 })
      env = {
        GIT_SSH_COMMAND: `ssh -i ${keyFile} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new`
      }
    }

    try {
      const options = request.branch ? ['--branch', request.branch] : []

      await Git.client(process.cwd(), env).clone(url, path, options)

      if (cleanUrl !== null) {
        await Git.client(path).remote(['set-url', 'origin', cleanUrl])
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      throw new BadRequest(`Falha ao clonar o repositório: ${message}`)
    } finally {
      if (keyFile !== null) rmSync(keyFile, { force: true })
    }
  }
}
