// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ts from 'typescript'

const SOURCE = resolve(import.meta.dirname, '../..')

function filesIn(directory: string): string[] {
    return readdirSync(directory, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
        .map((entry) => join(entry.parentPath, entry.name))
        .filter((file) => !file.includes('/__tests__/'))
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
        .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text)
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
    it('centraliza controllers, casos de uso e DTOs nas camadas da aplicação', () => {
        const misplaced = filesIn(join(SOURCE, 'modules'))
            .filter((file) => file.includes('/controllers/') || file.includes('/use-cases/') || file.includes('/dto/'))
            .map((file) => relative(SOURCE, file))
        const required = [
            join(SOURCE, 'controllers'),
            join(SOURCE, 'use-cases'),
            join(SOURCE, 'dto')
        ].filter((directory) => {
            try {
                return filesIn(directory).length === 0
            } catch {
                return true
            }
        }).map((directory) => relative(SOURCE, directory))

        expect([...misplaced, ...required]).toEqual([])
    })

    it('faz controllers dependerem somente de casos de uso', () => {
        const controllers = filesIn(join(SOURCE, 'controllers'))
        const violations = controllers
            .filter((file) => file.endsWith('.controller.ts'))
            .flatMap((file) => importsOf(file)
                .filter((dependency) => dependency.endsWith('.service.js'))
                .map((dependency) => `${relative(SOURCE, file)} -> ${dependency}`))

        expect(controllers.filter((file) => file.endsWith('.controller.ts'))).toHaveLength(8)
        expect(violations).toEqual([])
    })

    it('faz todo DTO público implementar um contrato compartilhado', () => {
        const violations = filesIn(join(SOURCE, 'dto'))
            .filter((file) => file.includes('/dto/') && file.endsWith('.dto.ts'))
            .filter((file) => {
                const source = readFileSync(file, 'utf8')

                return !source.includes('@acutis/contracts/') || !/export class \w+[^\n]*implements \w+/.test(source)
            })
            .map((file) => relative(SOURCE, file))

        expect(violations).toEqual([])
    })

    it('mantém tipos HTTP do frontend fora da aplicação', () => {
        const frontend = resolve(SOURCE, '../../frontend')
        const typeDeclarations = filesIn(join(frontend, 'app', 'types'))
            .filter((file) => /export interface /.test(readFileSync(file, 'utf8')))
            .map((file) => relative(frontend, file))
        const inlineContracts = [
            ...filesIn(join(frontend, 'app')),
            ...filesIn(join(frontend, 'server'))
        ]
            .filter((file) => /(?:useFetch|\$fetch|readBody)<\s*\{/.test(readFileSync(file, 'utf8')))
            .map((file) => relative(frontend, file))

        expect([
            ...typeDeclarations,
            ...inlineContracts
        ]).toEqual([])
    })

    it('mantém todos os domínios HTTP no pacote de contratos', () => {
        const contracts = resolve(SOURCE, '../../contracts/src')
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
        const missing = domains.filter((domain) => !filesIn(contracts).some((file) => file.endsWith(domain)))

        expect(missing).toEqual([])
    })

    it('não permite proxy genérico nas rotas do Nuxt', () => {
        const frontend = resolve(SOURCE, '../../frontend')
        const proxyHelper = join(frontend, 'server', 'utils', 'proxy.ts')
        const violations = filesIn(join(frontend, 'server', 'api'))
            .filter((file) => /\bproxy(?:Request)?\b/.test(readFileSync(file, 'utf8')))
            .map((file) => relative(frontend, file))

        if (readdirSync(join(frontend, 'server', 'utils')).some((entry) => entry === 'proxy.ts')) {
            violations.push(relative(frontend, proxyHelper))
        }

        expect(violations).toEqual([])
    })

    it('mantém controllers longe de filesystem e providers', () => {
        const violations = filesIn(join(SOURCE, 'controllers'))
            .filter((file) => file.endsWith('.controller.ts'))
            .flatMap((file) => importsOf(file)
                .filter((dependency) => dependency.startsWith('node:') || dependency.includes('/providers/'))
                .map((dependency) => `${relative(SOURCE, file)} -> ${dependency}`))

        expect(violations).toEqual([])
    })

    it('impede o módulo project de depender de detalhes do webdriver', () => {
        const violations = [
            ...filesIn(join(SOURCE, 'modules', 'project')),
            ...filesIn(join(SOURCE, 'use-cases', 'project'))
        ]
            .flatMap((file) => importsOf(file)
                .filter((dependency) => dependency.includes('webdriver'))
                .map((dependency) => `${relative(SOURCE, file)} -> ${dependency}`))

        expect(violations).toEqual([])
    })

    it('centraliza o acesso às variáveis do processo na configuração', () => {
        const allowed = new Set([
            'common/utils/acutis.ts',
            'config/env.ts'
        ])
        const violations = filesIn(SOURCE)
            .filter(accessesProcessEnv)
            .map((file) => relative(SOURCE, file))
            .filter((file) => !allowed.has(file))

        expect(violations).toEqual([])
    })
})
