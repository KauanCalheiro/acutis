import { describe, expect, it } from 'vitest'
import ScenarioFixModal from '~/components/scenario/fix/modal.vue'
import { dismiss, field, openModal, settle } from '../../../support/modal'

function open(props: Record<string, unknown> = {}) {
  return openModal(ScenarioFixModal, props)
}

describe('ScenarioFixModal', () => {
  it('espera enquanto a IA pensa na correção', async () => {
    await open({ loading: true })

    expect(field('correcao-carregando')).toBeDefined()
    expect(field('correcao-descartar')).toBeUndefined()
  })

  it('explica quando a correção não sai', async () => {
    await open({ error: 'O modelo não respondeu.' })

    expect(field('correcao-erro')!.textContent).toContain('O modelo não respondeu.')
    expect(field('correcao-aplicar')).toBeUndefined()
  })

  it('mostra o resumo e o teste corrigido', async () => {
    await open({ fix: { summary: 'Troquei o seletor pelo data-testid', playwright: 'await page.getByTestId(\'entrar\').click()' } })

    expect(field('correcao-resumo')!.textContent).toContain('Troquei o seletor pelo data-testid')
    expect((field('correcao-spec') as HTMLTextAreaElement).value).toContain('getByTestId')
  })

  it('fecha pelo esc quando não está aplicando nada', async () => {
    const { state } = await open({ fix: { summary: 'ok', playwright: 'test' } })

    await dismiss()

    expect(state.value).toBe(false)
  })

  it('aplica ou descarta a correção', async () => {
    const { wrapper } = await open({ fix: { summary: 'ok', playwright: 'test' } })

    field('correcao-aplicar')!.click()
    field('correcao-descartar')!.click()
    await settle()

    const modal = wrapper.findComponent(ScenarioFixModal)

    expect(modal.emitted('apply')).toHaveLength(1)
    expect(modal.emitted('discard')).toHaveLength(1)
  })
})
