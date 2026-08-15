// @vitest-environment node
/**
 * Leitura e reescrita do par `.feature` + `.spec.ts`. Portado de
 * `backend-laravel/tests/Unit/TestArtifactTest.php`.
 */
import { expect, it } from 'vitest'
import {
    scenario,
    stampGherkinTags,
    stampPlaywrightTitle,
    title,
    TITLE_LIMIT
} from './test-artifact.js'

/** O modelo às vezes devolve a feature inteira numa linha só, sem nenhuma quebra. */
const GHERKIN_NUMA_LINHA = '@read @cursos Funcionalidade: Consulta de cursos Como um usuário interessado '
    + 'Eu quero buscar cursos Cenário: Navegar para a lista Dado que estou na home Quando acesso a seção'

it('lê o título da linha da funcionalidade', () => {
    expect(title('Funcionalidade: Login do usuário\n  Cenário: entra')).toBe('Login do usuário')
})

it('para o título na próxima palavra-chave quando a feature veio numa linha só', () => {
    expect(title(GHERKIN_NUMA_LINHA)).toBe('Consulta de cursos')
})

it('corta um título que não caberia num nome de arquivo', () => {
    const cortado = title(`Funcionalidade: ${'palavra '.repeat(40)}`)

    expect(cortado.length).toBeLessThanOrEqual(TITLE_LIMIT)
    expect(cortado.endsWith('palavra')).toBe(true)
})

it('lê o nome do cenário e o para na próxima palavra-chave também', () => {
    expect(scenario(GHERKIN_NUMA_LINHA)).toBe('Navegar para a lista')
})

it('mantém o corpo da feature quando as tags dividem a linha com ele', () => {
    const stamped = stampGherkinTags(GHERKIN_NUMA_LINHA, ['@read', '@cursos'])

    expect(stamped).toContain('Funcionalidade: Consulta de cursos')
    expect(stamped.startsWith('@read @cursos')).toBe(true)
})

it('substitui a linha de tags que não carrega nada além de tags', () => {
    const stamped = stampGherkinTags('@antiga\nFuncionalidade: Login', ['@read'])

    expect(stamped).toBe('@read\nFuncionalidade: Login')
})

/** Sem .feature o título mora no describe: é de lá que ele é lido e é lá que é regravado. */
it('substitui o título dentro do describe do spec', () => {
    const stamped = stampPlaywrightTitle(
        "test.describe('Login', { tag: ['@read'] }, () => {})",
        'Entrar no sistema'
    )

    expect(stamped).toBe("test.describe('Entrar no sistema', { tag: ['@read'] }, () => {})")
})

it('escapa a aspa de um título que carrega uma, para o arquivo seguir válido', () => {
    const stamped = stampPlaywrightTitle("test.describe('Login', () => {})", "Entrar n'algum lugar")

    expect(stamped).toBe("test.describe('Entrar n\\'algum lugar', () => {})")
})

it('deixa exatamente como veio um spec sem describe', () => {
    const spec = "setup('autenticação', async () => {})"

    expect(stampPlaywrightTitle(spec, 'Outro')).toBe(spec)
})
