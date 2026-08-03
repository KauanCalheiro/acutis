import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import ScenarioReviewContexts from '~/components/scenario/review/contexts.vue'
import type { TestDraft } from '~/types/project'

// ponytail: reactive() aqui espelha o ref<TestDraft>() do modal.vue real — um objeto
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
})
