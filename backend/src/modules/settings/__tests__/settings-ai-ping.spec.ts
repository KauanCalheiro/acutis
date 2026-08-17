// @vitest-environment node
/** O ping do provedor: uma chamada de verdade ao modelo, para conferir o cadastro antes de salvá-lo. */
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { ProviderFailed } from '../../../common/exceptions/errors.js'
import { pingModel } from '../../ai/agents/ping.js'
import { startApi, type Harness } from '../../../../test/support/harness.js'
import { SettingsModule } from '../settings.module.js'

vi.mock('../../ai/agents/ping.js', () => ({ pingModel: vi.fn() }))

let api: Harness

beforeEach(async () => {
    vi.mocked(pingModel).mockReset()
    api = await startApi([SettingsModule])
})

afterEach(async () => {
    await api.close()
})

it('responde 200 quando o modelo responde', async () => {
    vi.mocked(pingModel).mockResolvedValue({ ok: true })

    const response = await api.http.post('/api/v1/settings/ai/ping').send({
        provider: 'openai',
        key: 'sk-de-mentira',
        model: 'gpt-4o-mini'
    })

    expect(response.status).toBe(200)
    expect(response.body.ok).toBe(true)
    expect(response.body.model).toBe('gpt-4o-mini')
    expect(typeof response.body.elapsed_ms).toBe('number')
})

it('pergunta ao provedor com o que está na tela, e não com o que está gravado', async () => {
    vi.mocked(pingModel).mockResolvedValue({ ok: true })

    await api.http.post('/api/v1/settings/ai/ping').send({
        provider: 'openai',
        key: 'a-chave-digitada-agora',
        url: 'https://proxy.exemplo.test/v1',
        model: 'gpt-4o-mini'
    })

    expect(vi.mocked(pingModel)).toHaveBeenCalledWith({
        provider: 'openai',
        key: 'a-chave-digitada-agora',
        url: 'https://proxy.exemplo.test/v1',
        model: 'gpt-4o-mini'
    })
})

it('devolve o motivo que o provedor deu quando ele recusa', async () => {
    vi.mocked(pingModel).mockRejectedValue(
        new ProviderFailed('O provedor openai recusou a credencial cadastrada.')
    )

    const response = await api.http.post('/api/v1/settings/ai/ping').send({
        provider: 'openai',
        key: 'sk-errada',
        model: 'gpt-4o-mini'
    })

    expect(response.status).toBe(502)
    expect(response.body.message).toBe('O provedor openai recusou a credencial cadastrada.')
})

it('recusa o ping sem modelo, que é justamente o que ele confere', async () => {
    const response = await api.http.post('/api/v1/settings/ai/ping').send({
        provider: 'openai',
        key: 'sk-de-mentira'
    })

    expect(response.status).toBe(422)
    expect(response.body.errors.model).toBeDefined()
    expect(vi.mocked(pingModel)).not.toHaveBeenCalled()
})

it('recusa o provedor que o acutis não conhece', async () => {
    const response = await api.http.post('/api/v1/settings/ai/ping').send({
        provider: 'provedor-inventado',
        model: 'qualquer-um'
    })

    expect(response.status).toBe(422)
    expect(vi.mocked(pingModel)).not.toHaveBeenCalled()
})
