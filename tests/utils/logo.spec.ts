import { describe, expect, it } from 'vitest'
import { logoPath, logoSvg } from '~/utils/logo'

describe('logoSvg', () => {
  it('monta o svg com as cores pedidas e o traçado da marca', () => {
    const svg = logoSvg('#000000', '#ffffff')

    expect(svg).toContain('fill="#000000"')
    expect(svg).toContain('stroke="#ffffff"')
    expect(svg).toContain(logoPath)
  })
})
