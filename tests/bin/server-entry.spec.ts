// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { serverEntryUrl } from '../../bin/server-entry.js'

describe('serverEntryUrl', () => {
  it('aponta para o bundle do Nitro dentro da raiz do pacote', () => {
    expect(serverEntryUrl('/opt/acutis')).toMatch(/\/\.output\/server\/index\.mjs$/)
  })

  it('devolve uma URL file://, a única que o loader ESM aceita', () => {
    expect(serverEntryUrl('/opt/acutis').startsWith('file://')).toBe(true)
  })

  it('escapa o caminho em vez de concatenar texto cru', () => {
    expect(serverEntryUrl('/opt/mi acutis')).toContain('mi%20acutis')
  })
})
