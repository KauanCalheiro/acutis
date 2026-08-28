/**
 * O git de um diretório de projeto, sobre o `simple-git`. Fora de um repositório toda operação aqui
 * é inócua.
 */
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { simpleGit, type SimpleGit } from 'simple-git'
import { acutis } from '../../../common/utils/acutis.js'

const PUSH_TIMEOUT_MS = 120_000
const FETCH_TIMEOUT_MS = 30_000

export type GitUnavailableReason = 'network' | 'authentication' | 'remote'
export type GitSync
  = { status: 'synced', changed: boolean }
    | { status: 'conflict', changed: boolean }
    | { status: 'unavailable', changed: boolean, reason: GitUnavailableReason }

/** Quantos commits cada lado tem que o outro não tem. */
export interface Divergence {
  ahead: number
  behind: number
}

/** O git recusou o commit porque não sabe quem está assinando. */
function missingIdentity(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''

  return /tell me who you are|unable to auto-detect|empty ident|user\.(name|email)/i.test(message)
}

/** O push foi recusado porque o remote tem commits que este repositório ainda não viu. */
function behindRemote(error: unknown): boolean {
  const message = error instanceof Error ? error.message : ''

  return /non-fast-forward|fetch first|rejected/i.test(message)
}

function unavailableReason(error: unknown): GitUnavailableReason {
  const message = error instanceof Error ? error.message : ''

  if (/authentication|could not read username|permission denied|publickey|access denied|403/i.test(message)) {
    return 'authentication'
  }
  if (/timed? out|could not resolve|connection|network|unable to access/i.test(message)) return 'network'

  return 'remote'
}

export class Git {
  private static readonly queues = new Map<string, Promise<void>>()

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

  private networkClient(timeout = FETCH_TIMEOUT_MS): SimpleGit {
    return simpleGit({ baseDir: this.path, binary: acutis().git, timeout: { block: timeout } })
  }

  /** O índice e o rebase são únicos por repositório, mesmo com várias telas fazendo ações. */
  private async exclusive<T>(operation: () => Promise<T>): Promise<T> {
    const previous = Git.queues.get(this.path) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.catch(() => undefined).then(() => gate)

    Git.queues.set(this.path, tail)
    await previous.catch(() => undefined)

    try {
      return await operation()
    } finally {
      release()
      if (Git.queues.get(this.path) === tail) Git.queues.delete(this.path)
    }
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

  /**
     * O que este repositório deve ao remote e o que o remote deve a ele, contado sem ir à rede: a
     * conta é contra o que o último `fetch` trouxe.
     */
  async divergence(): Promise<Divergence> {
    const counts = await this.output(
      git => git.raw(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
    )

    if (counts === null) return { ahead: 0, behind: 0 }

    const [ahead, behind] = counts.split(/\s+/).map(Number)

    return { ahead: ahead ?? 0, behind: behind ?? 0 }
  }

  private async head(): Promise<string | null> {
    return this.output(git => git.revparse(['HEAD']))
  }

  /** Projeto montado manualmente pode ter a branch remota, mas não a relação de upstream. */
  private async ensureUpstream(): Promise<void> {
    if ((await this.output(git => git.revparse(['--abbrev-ref', '@{upstream}']))) !== null) return

    const branch = await this.branch()
    if (!branch) return

    const remoteBranch = `refs/remotes/origin/${branch}`
    const exists = await this.output(git => git.raw(['show-ref', '--verify', remoteBranch]))

    if (exists !== null) {
      await this.client().raw(['branch', '--set-upstream-to', `origin/${branch}`, branch]).catch(() => null)
    }
  }

  /**
     * Traz o que o remote ganhou, para a ação que vem a seguir partir do que o time já subiu.
     * Conflito não trava nada: o rebase é abortado e a ação segue com o que está aqui.
     */
  private async pullUnlocked(): Promise<'synced' | 'conflict'> {
    if ((await this.divergence()).behind === 0) return 'synced'

    try {
      await this.client().raw(['rebase', '@{upstream}'])
      return 'synced'
    } catch {
      await this.client().raw(['rebase', '--abort']).catch(() => null)
      return 'conflict'
    }
  }

  /**
     * Junta os dois lados e diz se sobrou conflito. Conflito não é resolvido aqui: o rebase é
     * abortado, o trabalho local continua commitado, e quem decide é quem conhece os dois lados.
     */
  async sync(): Promise<GitSync> {
    return this.exclusive(async () => {
      if (!(await this.remoteUrl())) return { status: 'synced', changed: false }

      const before = await this.head()

      try {
        await this.networkClient().fetch(['origin'])
      } catch (error) {
        return { status: 'unavailable', changed: false, reason: unavailableReason(error) }
      }

      await this.ensureUpstream()

      if (await this.pullUnlocked() === 'conflict') {
        return { status: 'conflict', changed: false }
      }

      const pushed = await this.pushUnlocked()
      const changed = before !== await this.head()

      return pushed.status === 'synced' ? { status: 'synced', changed } : { ...pushed, changed }
    })
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

  /**
     * Máquina sem `git config user.name` recusa todo commit, e a pessoa passaria o dia achando que
     * versionou. A assinatura só é gravada aqui, no repositório do projeto, e só quando falta.
     */
  private async signLocally(): Promise<void> {
    await this.client().addConfig('user.name', 'Acutis').catch(() => null)
    await this.client().addConfig('user.email', 'acutis@local').catch(() => null)
  }

  private async commitUnlocked(message: string, files: string[]): Promise<void> {
    if (!this.isRepository()) return

    const staged = await this.stage(files)

    if (staged.length === 0) return

    try {
      await this.client().commit(message, staged)

      return
    } catch (error) {
      if (!missingIdentity(error)) return
    }

    await this.signLocally()

    try {
      await this.client().commit(message, staged)
    } catch {
      // Nada a commitar, ou o commit foi recusado por outro motivo.
    }
  }

  async commit(message: string, files: string[]): Promise<this> {
    await this.exclusive(() => this.commitUnlocked(message, files))

    return this
  }

  /** O que uma ação escreveu, versionado e enviado: é assim que o repositório acompanha a tela. */
  async save(message: string, files: string[]): Promise<void> {
    if (files.length === 0) return

    await this.exclusive(async () => {
      await this.commitUnlocked(message, files)
      await this.pushUnlocked()
    })
  }

  private pushClient(): SimpleGit {
    return this.networkClient(PUSH_TIMEOUT_MS)
  }

  /**
     * Empurra e, se o remote tiver andado, traz o que chegou por rebase e empurra de novo. É o que
     * mantém os dois lados juntos sem pedir nada a ninguém; conflito de verdade para o repique.
     */
  private async pushUnlocked(): Promise<GitSync> {
    if (!(await this.remoteUrl())) return { status: 'synced', changed: false }

    try {
      await this.pushClient().push('origin', 'HEAD', ['--set-upstream'])
      return { status: 'synced', changed: false }
    } catch (error) {
      if (!behindRemote(error)) {
        return { status: 'unavailable', changed: false, reason: unavailableReason(error) }
      }
    }

    try {
      await this.networkClient().fetch(['origin'])
      await this.ensureUpstream()
      if (await this.pullUnlocked() === 'conflict') return { status: 'conflict', changed: false }
      await this.pushClient().push('origin', 'HEAD', ['--set-upstream'])
      return { status: 'synced', changed: false }
    } catch (error) {
      await this.client().raw(['rebase', '--abort']).catch(() => null)
      return { status: 'unavailable', changed: false, reason: unavailableReason(error) }
    }
  }

  async push(): Promise<this> {
    await this.exclusive(() => this.pushUnlocked()).catch(() => null)

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
