/**
 * O git de um diretório de projeto, sobre o `simple-git`. Fora de um repositório toda operação aqui
 * é inócua.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { simpleGit, type SimpleGit } from 'simple-git'
import { acutis } from '../../../common/utils/acutis.js'

const PUSH_TIMEOUT_MS = 120_000

export class Git {
  private constructor(private readonly path: string) {}

  static in(path: string): Git {
    return new Git(path)
  }

  /** Se existe git nesta máquina. */
  static async available(): Promise<boolean> {
    try {
      await simpleGit({ binary: acutis().git, timeout: { block: 5_000 } }).version()

      return true
    } catch {
      return false
    }
  }

  /**
     * Um cliente apontado para um diretório qualquer, para clone e sondagem de remote. O `env`
     * recebe só o que se quer acrescentar, nunca `process.env` inteiro.
     */
  static client(baseDir: string, env: Record<string, string> = {}): SimpleGit {
    const git = simpleGit({
      baseDir,
      binary: acutis().git,
      unsafe: { allowUnsafeCustomBinary: true, allowUnsafeSshCommand: true }
    })

    return Object.keys(env).length === 0 ? git : git.env(env)
  }

  private client(): SimpleGit {
    return Git.client(this.path)
  }

  /** Se o diretório é um repositório por si, e não por estar dentro de um. */
  private isRepository(): boolean {
    return existsSync(join(this.path, '.git'))
  }

  private async output(read: (git: SimpleGit) => Promise<string>): Promise<string | null> {
    if (!this.isRepository()) return null

    try {
      return (await read(this.client())).trim() || null
    } catch {
      return null
    }
  }

  /** URL do remote `origin`, ou null quando o diretório não é repositório ou não tem remote. */
  async remoteUrl(): Promise<string | null> {
    return this.output(async (git) => {
      const origin = (await git.getRemotes(true)).find(remote => remote.name === 'origin')

      return origin?.refs.fetch ?? ''
    })
  }

  async branch(): Promise<string | null> {
    return this.output(async git => (await git.branch()).current)
  }

  async author(): Promise<string | null> {
    return this.output(git => git.raw(['config', 'user.name']))
  }

  /**
     * Um `add` por arquivo: o caminho que nunca existiu (o DOM que a gravação não capturou) faz o
     * git recusar a lista inteira, e aí a ação toda ficava pendente.
     */
  private async stage(files: string[]): Promise<string[]> {
    const staged: string[] = []

    for (const file of new Set(files)) {
      try {
        await this.client().add(file)
        staged.push(file)
      } catch {
        // Caminho que não existe no disco nem no índice.
      }
    }

    return staged
  }

  async commit(message: string, files: string[]): Promise<this> {
    if (!this.isRepository()) return this

    const staged = await this.stage(files)

    if (staged.length === 0) return this

    try {
      await this.client().commit(message, staged)
    } catch {
      // Nada a commitar, ou o commit foi recusado.
    }

    return this
  }

  /** O que uma ação escreveu, versionado e enviado: é assim que o repositório acompanha a tela. */
  async save(message: string, files: string[]): Promise<void> {
    if (files.length === 0) return

    await (await this.commit(message, files)).push()
  }

  async push(): Promise<this> {
    if (!(await this.remoteUrl())) return this

    try {
      await simpleGit({ baseDir: this.path, binary: acutis().git, timeout: { block: PUSH_TIMEOUT_MS } })
        .push('origin', 'HEAD')
    } catch {
      // Sem credencial ou sem rede.
    }

    return this
  }
}

export type GitProvider = 'github' | 'gitlab'

/** O provedor deduzido da URL do remote; null = só local, ou desconhecido. */
export function providerFromUrl(url: string | null): GitProvider | null {
  if (!url) return null

  if (url.includes('github.com')) return 'github'
  if (url.includes('gitlab.com')) return 'gitlab'

  return null
}
