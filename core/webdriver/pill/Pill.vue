<script setup lang="ts">
import { computed } from 'vue'
import PillButton from './PillButton.vue'
import PillIcon from './PillIcon.vue'
import { usePillState } from './usePillState'
import { useAssertMode } from './useAssertMode'
import { requestStop } from './transport'

defineOptions({ name: 'RecorderPill' })

const { isPaused, captureMode, togglePause, setCaptureMode } = usePillState()
const { isPopoverVisible, activateAssertMode, deactivateAssertMode }
  = useAssertMode()

const assertActive = computed(
  () => captureMode.value === 'assert' || isPopoverVisible.value
)

function toggleAssertMode() {
  if (assertActive.value) deactivateAssertMode()
  else activateAssertMode()
}

function toggleHoverMode() {
  setCaptureMode(captureMode.value === 'hover' ? null : 'hover')
}

function handleStop(e: MouseEvent) {
  e.stopPropagation()
  e.preventDefault()
  requestStop()
}
</script>

<template>
  <div
    class="pill"
    @click.stop.prevent
  >
    <span
      class="dot"
      :class="{ paused: isPaused }"
    />
    <div class="sep" />

    <PillButton
      :icon="isPaused ? 'resume' : 'pause'"
      tooltip="Pausar / Retomar"
      @click="togglePause"
    />
    <div class="sep" />

    <PillButton
      icon="assert"
      tooltip="Assert"
      :active="assertActive"
      @click="toggleAssertMode"
    />
    <PillButton
      icon="hover"
      tooltip="Hover"
      :active="captureMode === 'hover'"
      @click="toggleHoverMode"
    />
    <div class="sep" />

    <button
      class="btn btn-stop"
      @mousedown.prevent.stop
      @click="handleStop"
    >
      <span
        class="icon"
      >
        <PillIcon
          name="stop"
          :size="14"
        />
      </span>
      <span class="tooltip">Parar</span>
    </button>
  </div>
</template>
