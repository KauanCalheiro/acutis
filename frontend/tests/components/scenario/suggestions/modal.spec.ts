import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ScenarioSuggestionsModal from '~/components/scenario/suggestions/modal.vue'
import { field, openModal, settle } from '../../../support/modal'

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockClear()
  vi.stubGlobal('navigator', { clipboard: { writeText } })
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

function open(props: Record<string, unknown> = {}) {
  return openModal(ScenarioSuggestionsModal, props)
}

const suggestions = [{
  event: 'Clica em Entrar',
  reason: 'O seletor depende da posição do botão',
  currentSelector: 'button:nth-child(2)',
  suggestedTestId: 'login-entrar'
}]

describe('ScenarioSuggestionsModal', () => {
  it('espera enquanto a IA analisa a gravação', async () => {
    await open({ loading: true })

    expect(document.body.textContent).toContain('Analisando os eventos gravados')
  })

  it('explica quando as sugestões não saem', async () => {
    await open({ error: 'O modelo não respondeu.' })

    expect(document.body.textContent).toContain('Não foi possível gerar sugestões')
    expect(document.body.textContent).toContain('O modelo não respondeu.')
  })

  it('comemora quando não há nada a sugerir', async () => {
    await open({ suggestions: [] })

    expect(field('sugestoes-vazio')!.textContent).toContain('Nenhuma sugestão necessária')
  })

  it('mostra o seletor atual e o data-testid proposto', async () => {
    await open({ suggestions })

    expect(field('sugestao-card')!.textContent).toContain('Clica em Entrar')
    expect(field('sugestao-card')!.textContent).toContain('button:nth-child(2)')
    expect(field('sugestao-testid')!.textContent).toContain('data-testid="login-entrar"')
  })

  it('copia o data-testid e volta ao normal depois de avisar', async () => {
    vi.useFakeTimers()
    await open({ suggestions })

    field('sugestao-testid')!.click()
    await settle()

    expect(writeText).toHaveBeenCalledWith('login-entrar')

    await vi.advanceTimersByTimeAsync(1500)
    await settle()

    expect(writeText).toHaveBeenCalledTimes(1)
  })

  it('acompanha o modal quando ele mesmo se fecha', async () => {
    const { wrapper, state } = await open({ suggestions })

    wrapper.findComponent({ name: 'BaseModal' }).vm.$emit('update:open', false)
    await settle()

    expect(state.value).toBe(false)
  })

  it('fecha pelo botão', async () => {
    const { state } = await open({ suggestions })

    field('sugestoes-fechar')!.click()
    await settle()

    expect(state.value).toBe(false)
  })
})
