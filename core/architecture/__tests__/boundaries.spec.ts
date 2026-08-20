// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'

const SOURCE = resolve(import.meta.dirname, '../..')
const APP_ROOT = resolve(SOURCE, '..')

function filesIn(directory: string): string[] {
  return readdirSync(directory, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile() && entry.name.endsWith('.ts'))
    .map(entry => join(entry.parentPath, entry.name))
    .filter(file => !file.includes('/__tests__/'))
}

function importsOf(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )

  return source.statements
    .filter(ts.isImportDeclaration)
    .map(statement => (statement.moduleSpecifier as ts.StringLiteral).text)
}

function accessesProcessEnv(file: string): boolean {
  const source = ts.createSourceFile(
    file,
    readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  )
  let found = false

  function visit(node: ts.Node): void {
    if (
      ts.isPropertyAccessExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'process'
      && node.name.text === 'env'
    ) {
      found = true
    }

    ts.forEachChild(node, visit)
  }

  visit(source)

  return found
}

describe('fronteiras arquiteturais', () => {
  it('mantém artefatos do Nest fora do núcleo', () => {
    const obsolete = filesIn(SOURCE)
      .filter(file => /(?:\.controller|\.module|\.dto)\.ts$/.test(file))
      .map(file => relative(SOURCE, file))

    expect(obsolete).toEqual([])
  })

  it('faz handlers HTTP dependerem da composição, não de services concretos', () => {
    const handlers = [
      ...filesIn(join(APP_ROOT, 'server', 'api')),
      ...filesIn(join(APP_ROOT, 'server', 'routes'))
    ]
    const violations = handlers
      .flatMap(file => importsOf(file)
        .filter(dependency => dependency.endsWith('.service.js'))
        .map(dependency => `${relative(APP_ROOT, file)} -> ${dependency}`))

    expect(violations).toEqual([])
  })

  it('mantém os contratos HTTP em shared', () => {
    const contracts = filesIn(join(APP_ROOT, 'shared', 'contracts'))
    const misplaced = filesIn(SOURCE)
      .filter(file => file.includes('/dto/'))
      .map(file => relative(SOURCE, file))

    expect(contracts.length).toBeGreaterThan(0)
    expect(misplaced).toEqual([])
  })

  it('mantém tipos HTTP do frontend fora da aplicação', () => {
    const typeDeclarations = filesIn(join(APP_ROOT, 'app', 'types'))
      .filter(file => /export interface /.test(readFileSync(file, 'utf8')))
      .map(file => relative(APP_ROOT, file))
    const inlineContracts = [
      ...filesIn(join(APP_ROOT, 'app')),
      ...filesIn(join(APP_ROOT, 'server'))
    ]
      .filter(file => /(?:useFetch|\$fetch|readBody)<\s*\{/.test(readFileSync(file, 'utf8')))
      .map(file => relative(APP_ROOT, file))

    expect([
      ...typeDeclarations,
      ...inlineContracts
    ]).toEqual([])
  })

  it('mantém todos os domínios HTTP nos contratos internos', () => {
    const contracts = resolve(APP_ROOT, 'shared/contracts')
    const domains = [
      'auth.ts',
      'environment.ts',
      'generation.ts',
      'git.ts',
      'project.ts',
      'recording.ts',
      'scenario.ts',
      'settings.ts'
    ]
    const missing = domains.filter(domain => !filesIn(contracts).some(file => file.endsWith(domain)))

    expect(missing).toEqual([])
  })

  it('não permite proxy genérico nas rotas do Nuxt', () => {
    const proxyHelper = join(APP_ROOT, 'server', 'utils', 'proxy.ts')
    const violations = filesIn(join(APP_ROOT, 'server', 'api'))
      .filter(file => /\bproxy(?:Request)?\b/.test(readFileSync(file, 'utf8')))
      .map(file => relative(APP_ROOT, file))

    if (readdirSync(join(APP_ROOT, 'server', 'utils')).some(entry => entry === 'proxy.ts')) {
      violations.push(relative(APP_ROOT, proxyHelper))
    }

    expect(violations).toEqual([])
  })

  it('mantém handlers HTTP longe dos providers do núcleo', () => {
    const violations = [
      ...filesIn(join(APP_ROOT, 'server', 'api')),
      ...filesIn(join(APP_ROOT, 'server', 'routes'))
    ]
      .flatMap(file => importsOf(file)
        .filter(dependency => dependency.includes('/providers/'))
        .map(dependency => `${relative(APP_ROOT, file)} -> ${dependency}`))

    expect(violations).toEqual([])
  })

  it('impede o módulo project de depender de detalhes do webdriver', () => {
    const violations = [
      ...filesIn(join(SOURCE, 'modules', 'project')),
      ...filesIn(join(SOURCE, 'use-cases', 'project'))
    ]
      .flatMap(file => importsOf(file)
        .filter(dependency => dependency.includes('webdriver'))
        .map(dependency => `${relative(SOURCE, file)} -> ${dependency}`))

    expect(violations).toEqual([])
  })

  it('centraliza o acesso às variáveis do processo na configuração', () => {
    const allowed = new Set([
      'common/utils/acutis.ts',
      'config/env.ts'
    ])
    const violations = filesIn(SOURCE)
      .filter(accessesProcessEnv)
      .map(file => relative(SOURCE, file))
      .filter(file => !allowed.has(file))

    expect(violations).toEqual([])
  })
})
