import { ref, readonly } from 'vue'

/** As ações da pill que gravam um passo, e por isso confirmam no próprio botão. */
export type PillAction = 'assert' | 'hover' | 'url'

/** Quanto tempo o botão fica mostrando o check antes de voltar ao ícone dele. */
const CONFIRMED_MS = 700

const _isPaused = ref(false)
const _captureMode = ref<'assert' | 'hover' | null>(null)
const _eventCount = ref(0)
const _confirmedAction = ref<PillAction | null>(null)
let confirmedTimer: ReturnType<typeof setTimeout> | undefined

export function usePillState() {
  return {
    isPaused: readonly(_isPaused),
    captureMode: readonly(_captureMode),
    eventCount: readonly(_eventCount),
    confirmedAction: readonly(_confirmedAction),
    togglePause() { _isPaused.value = !_isPaused.value },
    setCaptureMode(mode: 'assert' | 'hover' | null) { _captureMode.value = mode },
    incrementEventCount() { _eventCount.value++ },
    /** Marca no botão que a ação dele acabou de virar passo da gravação. */
    confirmAction(action: PillAction) {
      _confirmedAction.value = action
      clearTimeout(confirmedTimer)
      confirmedTimer = setTimeout(() => {
        _confirmedAction.value = null
      }, CONFIRMED_MS)
    }
  }
}
