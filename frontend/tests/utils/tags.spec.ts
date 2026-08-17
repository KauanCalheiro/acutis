import { describe, expect, it } from 'vitest'
import { tagColor } from '~/utils/tags'

describe('tagColor', () => {
  it('separa leitura, escrita e o resto por cor', () => {
    expect(tagColor('@read')).toBe('success')
    expect(tagColor('@write')).toBe('warning')
    expect(tagColor('@smoke')).toBe('primary')
  })
})
