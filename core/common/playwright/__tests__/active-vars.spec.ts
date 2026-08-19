// @vitest-environment node
/** As variáveis do ambiente ativo, como as regras e o gerador as enxergam. */
import { expect, it } from 'vitest'
import { ActiveVars } from '../active-vars.js'
import type { EnvironmentVar } from '../../../modules/environment/providers/environment-var.js'

function vars(...list: Partial<EnvironmentVar>[]): EnvironmentVar[] {
  return list.map(item => ({ key: 'URL', value: 'https://app.test', secret: false, ...item })) as EnvironmentVar[]
}

it('recusa nome de variável fora do padrão', () => {
  expect(() => new ActiveVars(vars({ key: 'url minúscula' })))
    .toThrow('Nome de variável inválido: url minúscula')
})

it('recusa a mesma variável declarada duas vezes', () => {
  expect(() => new ActiveVars(vars({ key: 'URL' }, { key: 'URL' })))
    .toThrow('O ambiente declara a mesma variável duas vezes.')
})

it('nasce vazio quando o ambiente não declara nada', () => {
  const ambiente = new ActiveVars()

  expect(ambiente.has('URL')).toBe(false)
  expect(ambiente.get('URL')).toBeNull()
  expect(ambiente.exposed()).toEqual([])
})

it('encontra a chave que já guarda um valor', () => {
  const ambiente = new ActiveVars(vars({ key: 'SENHA', value: 'segredo', secret: true }))

  expect(ambiente.keyOf('segredo')).toBe('SENHA')
  expect(ambiente.keyOf('outro')).toBeNull()
  expect(ambiente.keyOf('')).toBeNull()
})

it('sabe qual variável está declarada sem valor', () => {
  const ambiente = new ActiveVars(vars({ key: 'URL', value: '' }, { key: 'SENHA', value: 'segredo' }))

  expect(ambiente.isEmpty('URL')).toBe(true)
  expect(ambiente.isEmpty('SENHA')).toBe(false)
  expect(ambiente.isEmpty('NAO_DECLARADA')).toBe(true)
})

it('só expõe o que tem valor e não é segredo', () => {
  const ambiente = new ActiveVars(vars(
    { key: 'URL', value: 'https://app.test' },
    { key: 'SENHA', value: 'segredo', secret: true },
    { key: 'VAZIA', value: '' }
  ))

  expect(ambiente.exposed().map(variable => variable.key)).toEqual(['URL'])
})
