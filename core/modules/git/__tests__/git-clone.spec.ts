// @vitest-environment node
/** As formas de acesso do clone: público, token e chave SSH. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { GitService } from '../git.service.js'
import { Git } from '../providers/git.js'

let source: string
let workdir: string

const git = new GitService()

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'acutis-clone-'))
  source = join(workdir, 'fonte')
  mkdirSync(source, { recursive: true })

  const run = (args: string[]) => execFileSync('git', args, { cwd: source, stdio: 'ignore' })

  run(['init', '-q'])
  writeFileSync(join(source, 'README.md'), '# fonte\n')
  run(['add', '-A'])
  run(['-c', 'user.email=t@t.dev', '-c', 'user.name=Test', 'commit', '-qm', 'readme'])
})

afterEach(() => {
  rmSync(workdir, { recursive: true, force: true })
})

function target(name: string): string {
  return join(workdir, name)
}

/** Quantas chaves SSH temporárias existem agora, porque o clone precisa apagar a que criou. */
function sshKeyDirs(): string[] {
  return readdirSync(tmpdir()).filter(entry => entry.startsWith('acutis-ssh-'))
}

it('sonda o repositório que responde sem credencial', async () => {
  expect(await git.probe(source)).toBe(true)
})

it('sonda como inacessível o repositório que não existe', async () => {
  expect(await git.probe(join(workdir, 'nao-existe'))).toBe(false)
})

it('clona o repositório público', async () => {
  await git.clone({ url: source }, target('publico'))

  expect(existsSync(join(target('publico'), 'README.md'))).toBe(true)
})

it('clona a branch pedida', async () => {
  execFileSync('git', ['branch', 'homologacao'], { cwd: source, stdio: 'ignore' })

  await git.clone({ url: source, branch: 'homologacao' }, target('com-branch'))

  expect(await Git.in(target('com-branch')).branch()).toBe('homologacao')
})

it('apaga a chave ssh temporária depois de clonar', async () => {
  const antes = sshKeyDirs().length

  await git.clone({ url: source, auth: 'ssh_key', ssh_key: '-----BEGIN KEY-----\nxxx\n-----END KEY-----' }, target('por-ssh'))

  expect(existsSync(join(target('por-ssh'), 'README.md'))).toBe(true)
  expect(sshKeyDirs().length).toBe(antes + 1)
  expect(sshKeyDirs().every(dir => !existsSync(join(tmpdir(), dir, 'key')))).toBe(true)
})

it('tira o token do remote depois de clonar', async () => {
  // A URL com token é a do próprio repositório local: o que importa é o remote que sobra.
  await git.clone({ url: source, auth: 'token', token: 'ghp_123' }, target('por-token'))

  expect(await Git.in(target('por-token')).remoteUrl()).toBe(source)
})

it('explica a falha do clone', async () => {
  await expect(git.clone({ url: join(workdir, 'nao-existe') }, target('quebrado')))
    .rejects.toThrow('Falha ao clonar o repositório')
})
