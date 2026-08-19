// @vitest-environment node
/** O git de um diretório de projeto: fora de um repositório, toda operação aqui é inócua. */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { Git } from '../providers/git.js'

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'acutis-git-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

function repository(): string {
  const path = join(dir, 'projeto')

  mkdirSync(path, { recursive: true })
  execFileSync('git', ['init', '-q'], { cwd: path })
  execFileSync('git', ['config', 'user.email', 't@t.dev'], { cwd: path })
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: path })

  return path
}

it('existe git nesta máquina', async () => {
  expect(await Git.available()).toBe(true)
})

it('não inventa dado nenhum fora de um repositório', async () => {
  const git = Git.in(dir)

  expect(await git.remoteUrl()).toBeNull()
  expect(await git.branch()).toBeNull()
  expect(await git.author()).toBeNull()
})

it('commitar e empurrar fora de um repositório não faz nada', async () => {
  const git = Git.in(dir)

  writeFileSync(join(dir, 'a.txt'), 'a')

  expect(await git.commit('nada', ['a.txt'])).toBe(git)
  expect(await git.push()).toBe(git)
})

it('lê branch e autor do repositório', async () => {
  const path = repository()

  writeFileSync(join(path, 'a.txt'), 'a')
  await Git.in(path).commit('primeiro', ['a.txt'])

  expect(await Git.in(path).author()).toBe('Test')
  expect(await Git.in(path).branch()).not.toBeNull()
  expect(await Git.in(path).remoteUrl()).toBeNull()
})

it('engole o commit que o git recusa', async () => {
  const path = repository()

  // Arquivo que não existe: o `git add` falha e o commit não acontece, sem quebrar a execução.
  const git = Git.in(path)

  expect(await git.commit('nada a commitar', ['nao-existe.txt'])).toBe(git)
})

it('não empurra o repositório sem remote', async () => {
  const path = repository()
  const git = Git.in(path)

  expect(await git.push()).toBe(git)
})

it('engole a falha de empurrar para um remote inalcançável', async () => {
  const path = repository()

  writeFileSync(join(path, 'a.txt'), 'a')
  await Git.in(path).commit('primeiro', ['a.txt'])
  execFileSync('git', ['remote', 'add', 'origin', join(dir, 'nao-existe')], { cwd: path })

  const git = Git.in(path)

  expect(await git.push()).toBe(git)
  expect(existsSync(join(dir, 'nao-existe'))).toBe(false)
})
