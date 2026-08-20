// @vitest-environment node
/** Leitura e reescrita do par `.feature` + `.spec.ts`. */
import { expect, it } from 'vitest'
import {
  scenario,
  stampGherkinTags,
  stampPlaywrightTags,
  stampPlaywrightTitle,
  tags,
  title,
  TITLE_LIMIT
} from '../providers/test-artifact.js'

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
    'test.describe(\'Login\', { tag: [\'@read\'] }, () => {})',
    'Entrar no sistema'
  )

  expect(stamped).toBe('test.describe(\'Entrar no sistema\', { tag: [\'@read\'] }, () => {})')
})

it('escapa a aspa de um título que carrega uma, para o arquivo seguir válido', () => {
  const stamped = stampPlaywrightTitle('test.describe(\'Login\', () => {})', 'Entrar n\'algum lugar')

  expect(stamped).toBe('test.describe(\'Entrar n\\\'algum lugar\', () => {})')
})

it('deixa exatamente como veio um spec sem describe', () => {
  const spec = 'setup(\'autenticação\', async () => {})'

  expect(stampPlaywrightTitle(spec, 'Outro')).toBe(spec)
})

it('cai no nome de reserva quando a feature não nomeia nem título nem cenário', () => {
  expect(title('Dado que estou na home')).toBe('teste')
  expect(scenario('Dado que estou na home')).toBe('executa o fluxo gravado')
})

it('lê as tags só da primeira linha, e só quando ela é uma linha de tags', () => {
  expect(tags('@read @cursos\nFuncionalidade: Consulta')).toEqual(['@read', '@cursos'])
  expect(tags('Funcionalidade: Consulta\n@read')).toEqual([])
  expect(tags('@\nFuncionalidade: Consulta')).toEqual([])
})

it('carimba a tag no describe que ainda não declarava nenhuma', () => {
  const stamped = stampPlaywrightTags('test.describe(\'Login\', async () => {})', ['@read'])

  expect(stamped).toBe('test.describe(\'Login\', {tag: [\'@read\']}, async () => {})')
})

it('troca a lista de tags que o describe já declarava', () => {
  const stamped = stampPlaywrightTags('test.describe(\'Login\', { tag: [\'@antiga\'] }, () => {})', ['@read'])

  expect(stamped).toContain('tag: [\'@read\']')
})

it('deixa o spec como veio quando não há tag a carimbar', () => {
  const spec = 'test.describe(\'Login\', () => {})'

  expect(stampPlaywrightTags(spec, [])).toBe(spec)
})

it('deixa a feature sem linha de tags quando a lista fica vazia', () => {
  expect(stampGherkinTags('@antiga\nFuncionalidade: Login', [])).toBe('Funcionalidade: Login')
})
