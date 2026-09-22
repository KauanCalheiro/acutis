import { describe, expect, it } from 'vitest'
import { authDraftSchema, scenarioDraftSchema } from '#shared/schemas/scenario'
import type { ScenarioDraft } from '#shared/schemas/scenario'

function draft(overrides: Partial<ScenarioDraft> = {}): ScenarioDraft {
  return {
    title: 'Login do cliente',
    path: 'login-do-cliente',
    domain: 'login',
    gherkin: '@read\nFuncionalidade: Login',
    playwright: 'test("login", async () => {})',
    tags: ['@read'],
    ...overrides
  }
}

describe('schema do rascunho de cenário', () => {
  it('aceita o rascunho com todos os contextos preenchidos', () => {
    expect(scenarioDraftSchema.safeParse(draft()).success).toBe(true)
  })

  it('recusa o cenário sem título', () => {
    const result = scenarioDraftSchema.safeParse(draft({ title: '' }))

    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBe('O título do cenário é obrigatório.')
  })

  it('recusa o cenário sem arquivo', () => {
    const result = scenarioDraftSchema.safeParse(draft({ path: '' }))

    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBe('O caminho do arquivo é obrigatório.')
  })

  it('recusa o cenário sem domínio', () => {
    const result = scenarioDraftSchema.safeParse(draft({ domain: '' }))

    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBe('O domínio do cenário é obrigatório.')
  })

  it('recusa o cenário sem o teste Playwright', () => {
    const result = scenarioDraftSchema.safeParse(draft({ playwright: '' }))

    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBe('O teste Playwright é obrigatório.')
  })

  it('aceita o cenário sem gherkin e sem tags', () => {
    expect(scenarioDraftSchema.safeParse(draft({ gherkin: '', tags: [] })).success).toBe(true)
  })

  it('recusa o título mais longo do que o nome de arquivo aceita', () => {
    expect(scenarioDraftSchema.safeParse(draft({ title: 'a'.repeat(121) })).success).toBe(false)
  })
})

describe('schema do rascunho de autenticação', () => {
  it('aceita a autenticação sem arquivo nem domínio', () => {
    const result = authDraftSchema.safeParse({
      title: 'Autenticação',
      gherkin: '',
      playwright: 'setup("login", async () => {})'
    })

    expect(result.success).toBe(true)
  })

  it('recusa a autenticação sem título', () => {
    const result = authDraftSchema.safeParse({
      title: '',
      gherkin: '',
      playwright: 'setup("login", async () => {})'
    })

    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBe('O título do cenário é obrigatório.')
  })

  it('recusa a autenticação sem o teste Playwright', () => {
    const result = authDraftSchema.safeParse({
      title: 'Autenticação',
      gherkin: '',
      playwright: ''
    })

    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBe('O teste Playwright é obrigatório.')
  })
})
