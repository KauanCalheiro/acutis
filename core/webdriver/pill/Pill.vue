<script setup lang="ts">
import { computed, ref } from 'vue'
import PillButton from './PillButton.vue'
import PillIcon from './PillIcon.vue'
import { usePillState } from './usePillState'
import { useAssertMode } from './useAssertMode'
import { requestStop, cancelRecording } from './transport'

defineOptions({ name: 'RecorderPill' })

const { isPaused, captureMode, confirmedAction, togglePause, setCaptureMode } = usePillState()
const { isPopoverVisible, activateAssertMode, deactivateAssertMode, assertUrl }
  = useAssertMode()

const assertActive = computed(
  () => captureMode.value === 'assert' || isPopoverVisible.value
)

const isCancelConfirmVisible = ref(false)

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

function requestCancel() {
  isCancelConfirmVisible.value = true
}

function dismissCancel() {
  isCancelConfirmVisible.value = false
}

function confirmCancel() {
  isCancelConfirmVisible.value = false
  cancelRecording()
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
      :confirmed="confirmedAction === 'assert'"
      @click="toggleAssertMode"
    />
    <PillButton
      icon="url"
      tooltip="Conferir a URL"
      :confirmed="confirmedAction === 'url'"
      data-acutis="conferir-url"
      @click="assertUrl"
    />
    <PillButton
      icon="hover"
      tooltip="Hover"
      :active="captureMode === 'hover'"
      :confirmed="confirmedAction === 'hover'"
      @click="toggleHoverMode"
    />
    <div class="sep" />

    <PillButton
      icon="cancel"
      tooltip="Cancelar"
      data-acutis="cancelar"
      @click="requestCancel"
    />
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

    <div
      v-if="isCancelConfirmVisible"
      class="surface cancel-confirm"
      data-acutis="cancelar-confirmar"
      @click.stop
      @mousedown.stop
    >
      <p class="cancel-confirm-text">
        Descartar esta gravação?
      </p>
      <div class="surface-actions">
        <button
          class="surface-action"
          data-acutis="cancelar-nao"
          @mousedown.prevent.stop
          @click.stop.prevent="dismissCancel"
        >
          Não
        </button>
        <button
          class="surface-action surface-action-danger"
          data-acutis="cancelar-sim"
          @mousedown.prevent.stop
          @click.stop.prevent="confirmCancel"
        >
          Sim
        </button>
      </div>
    </div>
  </div>
</template>
