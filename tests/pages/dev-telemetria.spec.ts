import { describe, expect, it, vi, beforeEach } from 'vitest'
import { mountSuspended, mockNuxtImport, registerEndpoint } from '@nuxt/test-utils/runtime'
import { DEFAULT_TELEMETRY_URL } from '@acutis/core/config/telemetry-endpoint'
import DevTelemetria from '~/pages/dev/telemetria.vue'

const failure = vi.fn()
const success = vi.fn()

mockNuxtImport('useNotify', () => () => ({ failure, success }))

registerEndpoint('/debug/erro-de-telemetria', {
  method: 'GET',
  handler: () => {
    throw createError({ statusCode: 500, data: { message: 'O provedor de IA recusou a chamada.' } })
  }
})

beforeEach(() => {
  failure.mockClear()
})

describe('página de dev da telemetria', () => {
  it('provoca o erro e manda para a toast com o contexto', async () => {
    const page = await mountSuspended(DevTelemetria)

    await page.find('button').trigger('click')
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(failure).toHaveBeenCalledOnce()
    const [, fallback, contexto] = failure.mock.lastCall!
    expect(fallback).toContain('erro de teste')
    expect(contexto).toBe('Página de dev da telemetria')
  })

  it('mostra para onde o relato vai, ou avisa que não há servidor', async () => {
    const page = await mountSuspended(DevTelemetria)

    expect(page.text()).toContain(DEFAULT_TELEMETRY_URL || 'nenhum servidor configurado')
  })
})
