import { ref, readonly } from 'vue'

const _isPaused = ref(false)
const _captureMode = ref<'assert' | 'hover' | null>(null)
const _eventCount = ref(0)

export function usePillState() {
  return {
    isPaused: readonly(_isPaused),
    captureMode: readonly(_captureMode),
    eventCount: readonly(_eventCount),
    togglePause() { _isPaused.value = !_isPaused.value },
    setCaptureMode(mode: 'assert' | 'hover' | null) { _captureMode.value = mode },
    incrementEventCount() { _eventCount.value++ }
  }
}
