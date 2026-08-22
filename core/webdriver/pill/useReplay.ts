import { ref, readonly } from 'vue'

/** O mesmo shape que o gravador devolve; a pill não importa nada do lado Node. */
export interface ReplayState {
  status: 'idle' | 'running' | 'failed'
  step: string | null
}

declare global {
  interface Window {
    __acutisReplayState?: () => Promise<ReplayState>
    __acutisReplayDecision?: (decision: 'resume' | 'cancel') => void
  }
}

const POLL_MS = 300

const _state = ref<ReplayState>({ status: 'idle', step: null })
let timer: ReturnType<typeof setInterval> | undefined

/**
 * O estado da retomada é perguntado ao gravador, e não recebido dele: cada navegação refeita
 * recarrega a página, e um valor guardado aqui não sobreviveria a ela.
 */
export function useReplay() {
  function stopWatching(): void {
    clearInterval(timer)
    timer = undefined
  }

  async function read(): Promise<void> {
    const ask = window.__acutisReplayState

    if (!ask) return

    try {
      _state.value = await ask()
    } catch {
      // Gravador encerrando: a página está indo embora junto.
      _state.value = { status: 'idle', step: null }
    }

    if (_state.value.status === 'idle') stopWatching()
  }

  async function watch(): Promise<void> {
    await read()

    if (_state.value.status === 'idle' || timer) return

    timer = setInterval(() => void read(), POLL_MS)
  }

  function decide(decision: 'resume' | 'cancel'): void {
    window.__acutisReplayDecision?.(decision)
    _state.value = { status: 'idle', step: null }
    stopWatching()
  }

  return { state: readonly(_state), watch, decide, stopWatching }
}
