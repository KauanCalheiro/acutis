// @vitest-environment node
/**
 * O repositório do projeto se resolve sozinho: cada ação empurra, e o que chegou de fora é trazido
 * no repique. Só o conflito de verdade sobra para alguém decidir.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { startApi, type Harness } from '../../../../test/support/harness.js'

let api: Harness
let dir: string
let origin: string
let outro: string

function git(repo: string, args: string[]): string {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
}

beforeEach(async () => {
  api = await startApi([])
  dir = api.projectPath('minha-loja')
  origin = join(api.root, 'origin.git')
  outro = join(api.root, 'outro')

  execFileSync('git', ['init', '-q', '--bare', origin])

  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'acutis.json'), JSON.stringify({
    name: 'Minha Loja',
    slug: 'minha-loja',
    created_at: '2026-01-01T00:00:00+00:00',
    version: 1
  }))

  execFileSync('git', ['init', '-q', '-b', 'main', dir])
  git(dir, ['config', 'user.email', 'testadora@acutis.dev'])
  git(dir, ['config', 'user.name', 'Testadora'])
  git(dir, ['remote', 'add', 'origin', origin])
  git(dir, ['add', '.'])
  git(dir, ['commit', '-qm', 'chore: início'])
  git(dir, ['push', '-q', '-u', 'origin', 'main'])
})

afterEach(async () => {
  await api.close()
})

/** Um segundo clone empurra por fora, que é o time trabalhando no mesmo projeto. */
function remoteAvancou(arquivo = 'cupom.spec.ts', conteudo = 'test.describe(\'Cupom\', () => {})'): void {
  execFileSync('git', ['clone', '-q', origin, outro])
  git(outro, ['config', 'user.email', 'outra@acutis.dev'])
  git(outro, ['config', 'user.name', 'Outra'])
  writeFileSync(join(outro, arquivo), conteudo)
  git(outro, ['add', '.'])
  git(outro, ['commit', '-qm', `test: ${arquivo} de fora`])
  git(outro, ['push', '-q', 'origin', 'main'])
}

function salvarConfiguracoes() {
  return api.http.put('/api/v1/projects/minha-loja/settings').send({ baseUrl: 'https://loja.test' })
}

function sync() {
  return api.http.post('/api/v1/projects/minha-loja/git/sync')
}

it('empurra o que a ação escreveu, sem ninguém pedir', async () => {
  await salvarConfiguracoes().expect(200)

  expect(git(origin, ['log', '--oneline'])).toContain('atualizar configurações')
})

it('traz o que chegou de fora no repique, quando o push é recusado', async () => {
  remoteAvancou()

  await salvarConfiguracoes().expect(200)

  expect(git(dir, ['log', '--oneline']), 'o que veio de fora entrou aqui').toContain('cupom.spec.ts de fora')
  expect(git(origin, ['log', '--oneline']), 'e o que era daqui subiu').toContain('atualizar configurações')
  expect(git(dir, ['status', '--porcelain']).trim()).toBe('')
})

it('guarda o trabalho local quando o repique esbarra num conflito', async () => {
  remoteAvancou('.gitignore', 'node_modules\nresults\n')

  const response = await salvarConfiguracoes()

  expect(response.status, 'a ação não falha porque o git divergiu').toBe(200)
  expect(git(dir, ['log', '--oneline']), 'o trabalho ficou commitado aqui').toContain('atualizar configurações')
  expect(git(dir, ['status', '--porcelain']).trim(), 'e o repositório não fica no meio de um rebase').toBe('')
})

it('sincroniza sozinho quando a tela abre, e diz que está tudo certo', async () => {
  remoteAvancou()

  const response = await sync()

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ status: 'synced', changed: true })
  expect(git(dir, ['log', '--oneline'])).toContain('cupom.spec.ts de fora')
})

it('avisa que há conflito, e é a única coisa que a tela precisa saber', async () => {
  remoteAvancou('.gitignore', 'node_modules\nresults\n')
  writeFileSync(join(dir, '.gitignore'), 'node_modules\nplaywright-report\n')
  git(dir, ['add', '.'])
  git(dir, ['commit', '-qm', 'chore: ignorar o relatório'])

  const response = await sync()

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ status: 'conflict', changed: false })
  expect(git(dir, ['status', '--porcelain']).trim(), 'nada de rebase pela metade').toBe('')
})

/** Máquina nova, sem `git config user.name`: o commit falharia calado e nada seria versionado. */
it('assina o commit sozinho quando a máquina não tem identidade git', async () => {
  git(dir, ['config', '--unset', 'user.name'])
  git(dir, ['config', '--unset', 'user.email'])
  // Sem isto o git inventa a identidade a partir do usuário do sistema, que é o que ele faz numa
  // máquina de trabalho. O caso que interessa é o container ou CI, onde não há de onde inventar.
  git(dir, ['config', 'user.useConfigOnly', 'true'])

  // O git só ignora a configuração de fora com estas duas variáveis; sem elas o teste herdaria a
  // identidade de quem está rodando a suíte.
  const anteriores = { global: process.env.GIT_CONFIG_GLOBAL, system: process.env.GIT_CONFIG_SYSTEM }
  process.env.GIT_CONFIG_GLOBAL = '/dev/null'
  process.env.GIT_CONFIG_SYSTEM = '/dev/null'

  try {
    await salvarConfiguracoes().expect(200)
  } finally {
    process.env.GIT_CONFIG_GLOBAL = anteriores.global
    process.env.GIT_CONFIG_SYSTEM = anteriores.system
  }

  expect(git(dir, ['log', '-1', '--pretty=format:%s'])).toContain('atualizar configurações')
  expect(git(dir, ['log', '-1', '--pretty=format:%an'])).toBe('Acutis')
})

it('não atropela a identidade de quem já tem a sua', async () => {
  await salvarConfiguracoes().expect(200)

  expect(git(dir, ['log', '-1', '--pretty=format:%an'])).toBe('Testadora')
})

/**
 * Projeto que virou repositório na mão costuma ficar sem upstream, e aí a conta de divergência não
 * existe: o acutis acharia que está sempre em dia.
 */
it('configura o upstream no primeiro envio', async () => {
  git(dir, ['branch', '--unset-upstream'])

  await salvarConfiguracoes().expect(200)

  expect(git(dir, ['rev-parse', '--abbrev-ref', 'main@{upstream}']).trim()).toBe('origin/main')
})

it('encontra a branch remota que avançou mesmo quando o upstream local sumiu', async () => {
  git(dir, ['branch', '--unset-upstream'])
  remoteAvancou()

  const response = await sync()

  expect(response.body).toMatchObject({ status: 'synced', changed: true })
  expect(git(dir, ['log', '--oneline'])).toContain('cupom.spec.ts de fora')
  expect(git(dir, ['rev-parse', '--abbrev-ref', 'main@{upstream}']).trim()).toBe('origin/main')
})

it('distingue remote indisponível de repositório sincronizado', async () => {
  git(dir, ['remote', 'set-url', 'origin', join(api.root, 'nao-existe.git')])

  const response = await sync()

  expect(response.body).toMatchObject({ status: 'unavailable', changed: false, reason: 'remote' })
})

it('serializa duas sincronizações do mesmo projeto sem deixar lock ou rebase pela metade', async () => {
  remoteAvancou()

  const [first, second] = await Promise.all([sync(), sync()])

  expect(first.status).toBe(200)
  expect(second.status).toBe(200)
  expect([first.body.status, second.body.status]).toEqual(['synced', 'synced'])
  expect(git(dir, ['status', '--porcelain']).trim()).toBe('')
  expect(git(dir, ['log', '--oneline'])).toContain('cupom.spec.ts de fora')
})

it('deixa o projeto sem remote em paz', async () => {
  git(dir, ['remote', 'remove', 'origin'])

  const response = await sync()

  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ status: 'synced', changed: false })
})
