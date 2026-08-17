import { describe, expect, it, vi } from 'vitest'
import { mockNuxtImport } from '@nuxt/test-utils/runtime'
import { AI_SETTINGS_KEY, useAi } from '~/composables/ai'

const { data, useFetchMock } = vi.hoisted(() => {
  const data = { value: null as { configured: boolean } | null }

  return { data, useFetchMock: vi.fn(() => ({ data })) }
})

mockNuxtImport('useFetch', () => useFetchMock)

describe('useAi', () => {
  it('busca as configurações na chave que a tela de settings invalida', () => {
    useAi()

    expect(useFetchMock.mock.calls[0]!.slice(0, 2)).toEqual(['/api/settings/ai', { key: AI_SETTINGS_KEY }])
  })

  it('só diz configurado quando o backend confirma', () => {
    data.value = null
    expect(useAi().configured.value).toBe(false)

    data.value = { configured: true }
    expect(useAi().configured.value).toBe(true)
  })
})
