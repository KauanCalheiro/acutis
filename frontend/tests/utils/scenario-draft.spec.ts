import { describe, expect, it } from 'vitest'
import { PATH_LIMIT, draftFromScenario, slugify } from '~/utils/scenario-draft'
import type { ScenarioDetail } from '~/types/project'

describe('slugify', () => {
  it('tira acento, caixa alta e pontuação', () => {
    expect(slugify('Login com Ação!')).toBe('login-com-acao')
  })

  it('respeita o limite do caminho sem deixar traço na ponta', () => {
    const slug = slugify('a'.repeat(PATH_LIMIT) + ' b')

    expect(slug).toHaveLength(PATH_LIMIT)
    expect(slug.endsWith('-')).toBe(false)
  })
})

describe('draftFromScenario', () => {
  const scenario = (spec: string): ScenarioDetail => ({
    spec,
    title: 'Entrar no sistema',
    tags: ['@read'],
    gherkin: null,
    playwright: 'test("x", async () => {})'
  } as ScenarioDetail)

  it('separa domínio e arquivo do caminho do spec', () => {
    expect(draftFromScenario(scenario('tests/auth/login.spec.ts'))).toEqual({
      title: 'Entrar no sistema',
      path: 'login',
      domain: 'auth',
      tags: ['@read'],
      gherkin: '',
      playwright: 'test("x", async () => {})'
    })
  })

  it('deixa o domínio vazio quando o spec está na raiz', () => {
    const draft = draftFromScenario(scenario('tests/login.spec.ts'))

    expect(draft.domain).toBe('')
    expect(draft.path).toBe('login')
  })

  it('mantém o gherkin quando o cenário tem um', () => {
    expect(draftFromScenario({ ...scenario('tests/a/b.spec.ts'), gherkin: 'Dado que' } as ScenarioDetail).gherkin)
      .toBe('Dado que')
  })
})
