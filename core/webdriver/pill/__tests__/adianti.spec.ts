// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { useSelectorCapture } from '../useSelectorCapture'
import { HTML } from './adianti-fixture'

describe('tela do Adianti', () => {
  const { extractSelectors } = useSelectorCapture()

  function selectorsOf(css: string) {
    document.body.innerHTML = HTML

    return extractSelectors(document.querySelector(css)!)
  }

  it('escolhe o name do campo, não o id que o Adianti regenera', () => {
    const selectors = selectorsOf('#tentry_1409028412')

    expect(selectors.cssStable).toBe('input[name="id"]')
    expect(selectors.finder).not.toContain('tentry_')
  })

  it('escolhe o aria-label do botão', () => {
    expect(selectorsOf('#tbutton_btn_buscar').ariaLabel).toBe('Buscar')
  })

  it('não deixa o id regerado entrar em nenhum seletor do combo', () => {
    const selectors = selectorsOf('#tdbmultisearch_1987664670')

    expect(selectors.cssStable).toBe('select[name="ref_centro_custo"]')
    expect(selectors.finder).not.toContain('tdbmultisearch_')
  })

  it('cai na classe do select2 para o combo que o usuário clica', () => {
    const selectors = selectorsOf('.select2-selection')

    expect(selectors.ariaRole).toBe('combobox')
    expect(selectors.finder).toBe('.select2-selection')
  })
})
