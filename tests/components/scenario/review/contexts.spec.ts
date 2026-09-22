import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioReviewContexts from '~/components/scenario/review/contexts.vue'
import type { TestDraft } from '~/types/project'

// ponytail: reactive() aqui espelha o ref<TestDraft>() do modal.vue real, porque um objeto
// plain como prop não propaga mutações internas do codefield (v-model aninhado)
function draft(overrides: Partial<TestDraft> = {}): TestDraft {
  return reactive({
    title: 'Login do cliente',
    tags: ['@read', '@login'],
    domain: 'login',
    path: 'login-do-cliente',
    gherkin: '@read @login\nFuncionalidade: Login\n  Cenário: entra',
    playwright: 'import { test } from \'@playwright/test\'\n\ntest.describe(\'Login\', { tag: [\'@read\', \'@login\'] }, () => {})',
    ...overrides
  })
}

/** O asterisco do obrigatório é desenhado pelo `::after` do label, então é a classe que o denuncia. */
function marcadoObrigatorio(root: HTMLElement, label: string): boolean {
  const found = [...root.querySelectorAll('label')].find(el => el.textContent?.trim() === label)

  return found?.className.includes('after:content-[\'*\']') ?? false
}

describe('ScenarioReviewContexts', () => {
  it('renders the domain field seeded from the draft', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    expect(wrapper.get('[data-testid="contexto-dominio"]').element).toHaveProperty('value', 'login')
  })

  it('replicates an edit in the tags field into the gherkin and playwright tag lines', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    await wrapper.get('[data-testid="contexto-tags"]').setValue('@read @checkout')
    const emitted = wrapper.emitted('update:draft') as Array<[TestDraft]>
    const last = emitted.at(-1)![0]

    expect(last.tags).toEqual(['@read', '@checkout'])
    expect(last.gherkin.split('\n')[0]).toBe('@read @checkout')
    expect(last.playwright).toContain('tag: [\'@read\', \'@checkout\']')
  })

  it('replicates an edit in the gherkin tag line back into the tags field', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    await wrapper.get('[data-testid="contexto-cenario"]').setValue('@write @checkout\nFuncionalidade: Login\n  Cenário: entra')
    const emitted = wrapper.emitted('update:draft') as Array<[TestDraft]>
    const last = emitted.at(-1)![0]

    expect(last.tags).toEqual(['@write', '@checkout'])
    expect(last.playwright).toContain('tag: [\'@write\', \'@checkout\']')
  })

  it('caps the fields that become a file name', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    expect(wrapper.get('[data-testid="contexto-titulo"]').attributes('maxlength')).toBe('120')
    expect(wrapper.get('[data-testid="contexto-path"]').attributes('maxlength')).toBe('80')
    expect(wrapper.get('[data-testid="contexto-dominio"]').attributes('maxlength')).toBe('80')
  })

  it('marca como obrigatórios os contextos que o cenário exige', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    for (const label of ['Título do cenário', 'Arquivo', 'Domínio', 'Teste (Playwright)']) {
      expect(marcadoObrigatorio(wrapper.element as HTMLElement, label)).toBe(true)
    }
  })

  it('cobra domínio também na edição de um cenário que já está em disco', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    expect(marcadoObrigatorio(wrapper.element as HTMLElement, 'Domínio')).toBe(true)
  })

  it('deixa tags e gherkin sem marca de obrigatório', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    for (const label of ['Tags', 'Cenário (Gherkin)']) {
      expect(marcadoObrigatorio(wrapper.element as HTMLElement, label)).toBe(false)
    }
  })

  it('esconde arquivo, domínio e tags na autenticação', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft(), isAuth: true }
    })

    expect(wrapper.find('[data-testid="contexto-path"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="contexto-dominio"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="contexto-tags"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="contexto-titulo"]').exists()).toBe(true)
  })

  it('replica a tag editada no teste de volta nos outros campos', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    await wrapper.get('[data-testid="contexto-teste"]').setValue(
      'test.describe(\'Login\', { tag: [\'@write\'] }, () => {})'
    )
    const last = (wrapper.emitted('update:draft') as Array<[TestDraft]>).at(-1)![0]

    expect(last.tags).toEqual(['@write'])
    expect(last.gherkin.split('\n')[0]).toBe('@write')
  })

  it('carimba a tag num teste que ainda não declarava nenhuma', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft({ tags: [], gherkin: 'Funcionalidade: Login', playwright: 'test.describe(\'Login\', async () => {})' }) }
    })

    await wrapper.get('[data-testid="contexto-tags"]').setValue('@read')
    const last = (wrapper.emitted('update:draft') as Array<[TestDraft]>).at(-1)![0]

    expect(last.playwright).toContain('tag: [\'@read\']')
    expect(last.gherkin.split('\n')[0]).toBe('@read')
  })

  it('deixa o gherkin sem linha de tag quando as tags são apagadas', async () => {
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: draft() }
    })

    await wrapper.get('[data-testid="contexto-tags"]').setValue('')
    const last = (wrapper.emitted('update:draft') as Array<[TestDraft]>).at(-1)![0]

    expect(last.tags).toEqual([])
    expect(last.gherkin.startsWith('@')).toBe(false)
  })

  it('faz o arquivo seguir o título no cenário novo, até alguém editá-lo', async () => {
    const state = draft({ title: 'Login', path: 'login', novo: true })
    const wrapper = await mountSuspended(ScenarioReviewContexts, {
      props: { draft: state, novo: true }
    })

    await wrapper.get('[data-testid="contexto-titulo"]').setValue('Login do gerente')
    expect((wrapper.emitted('update:draft') as Array<[TestDraft]>).at(-1)![0].path)
      .toBe('login-do-gerente')

    await wrapper.get('[data-testid="contexto-path"]').setValue('escolhido-na-mao')
    await wrapper.get('[data-testid="contexto-titulo"]').setValue('Outro título')

    expect((wrapper.emitted('update:draft') as Array<[TestDraft]>).at(-1)![0].path)
      .toBe('escolhido-na-mao')
  })
})
