import { describe, it, expect } from 'vitest'
import { counted, plural } from '~/utils/plural'

describe('plural', () => {
  it('usa o singular para um', () => {
    expect(plural(1, 'cenário', 'cenários')).toBe('cenário')
    expect(plural(1, 'falhou', 'falharam')).toBe('falhou')
  })

  it('usa o plural para nenhum e para muitos', () => {
    expect(plural(0, 'cenário', 'cenários')).toBe('cenários')
    expect(plural(2, 'cenário', 'cenários')).toBe('cenários')
  })
})

describe('counted', () => {
  it('troca o zero pela frase que soa como gente', () => {
    expect(counted(0, 'falhou', 'falharam', 'nenhum falhou')).toBe('nenhum falhou')
  })

  it('conta com a palavra que concorda', () => {
    expect(counted(1, 'falhou', 'falharam', 'nenhum falhou')).toBe('1 falhou')
    expect(counted(3, 'falhou', 'falharam', 'nenhum falhou')).toBe('3 falharam')
  })
})
