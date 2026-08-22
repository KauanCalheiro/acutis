// @vitest-environment jsdom
/** A cortina só sai do ar quando a ferramenta larga o controle da página. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useReplay } from '../useReplay'

interface State { status: string, step: string | null }

function withHost(states: State[], decision = vi.fn()) {
  const queue = [...states]
  const win = window as unknown as Record<string, unknown>

  win.__acutisReplayState = vi.fn(async () => queue.length > 1 ? queue.shift()! : queue[0]!)
  win.__acutisReplayDecision = decision

  return { decision }
}

afterEach(() => {
  const win = window as unknown as Record<string, unknown>
  delete win.__acutisReplayState
  delete win.__acutisReplayDecision
  useReplay().stopWatching()
  vi.useRealTimers()
})

describe('useReplay', () => {
  it('não mostra cortina nenhuma numa gravação sem retomada', async () => {
    withHost([{ status: 'idle', step: null }])
    const { state, watch } = useReplay()

    await watch()

    expect(state.value.status).toBe('idle')
  })

  it('não mostra cortina quando o gravador não expõe o estado (gravação antiga)', async () => {
    const { state, watch } = useReplay()

    await watch()

    expect(state.value.status).toBe('idle')
  })

  it('mostra o passo que está sendo refeito e some quando a ferramenta termina', async () => {
    vi.useFakeTimers()
    withHost([
      { status: 'running', step: 'Abre /login' },
      { status: 'idle', step: null }
    ])
    const { state, watch } = useReplay()

    await watch()
    expect(state.value).toEqual({ status: 'running', step: 'Abre /login' })

    await vi.advanceTimersByTimeAsync(400)
    expect(state.value.status).toBe('idle')
  })

  it('devolve a decisão do usuário para o gravador', async () => {
    const { decision } = withHost([{ status: 'failed', step: 'Clica em "Entrar"' }])
    const { state, watch, decide } = useReplay()

    await watch()
    expect(state.value).toEqual({ status: 'failed', step: 'Clica em "Entrar"' })

    decide('resume')

    expect(decision).toHaveBeenCalledWith('resume')
    expect(state.value.status).toBe('idle')
  })
})
