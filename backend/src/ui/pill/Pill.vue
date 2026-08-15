<script setup lang="ts">
import { computed } from "vue"
import PillButton from "./PillButton.vue"
import { usePillState } from "./usePillState"
import { useAssertMode } from "./useAssertMode"
import { requestStop } from "../transport"

const { isPaused, captureMode, togglePause, setCaptureMode } = usePillState()
const { isPopoverVisible, activateAssertMode, deactivateAssertMode } =
  useAssertMode()

const assertActive = computed(
  () => captureMode.value === "assert" || isPopoverVisible.value,
)

const ICONS = {
  pause: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="2" width="3.5" height="10" rx="1" fill="white"/><rect x="8" y="2" width="3.5" height="10" rx="1" fill="white"/></svg>`,
  resume: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3.5 2.5L11.5 7L3.5 11.5V2.5Z" fill="white"/></svg>`,
  assert: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="5.25" stroke="white" stroke-width="1.5"/><path d="M4.5 7L6.5 9L9.5 5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  hoverMode: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 1.5V10.5L5.5 8.2L7.5 12.5L9 11.8L7 7.5L11 7.5L3 1.5Z" fill="white"/></svg>`,
  stop: `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2.5" y="2.5" width="9" height="9" rx="1.5" fill="white"/></svg>`,
}

function toggleAssertMode() {
  if (assertActive.value) deactivateAssertMode()
  else activateAssertMode()
}

function toggleHoverMode() {
  setCaptureMode(captureMode.value === "hover" ? null : "hover")
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
      :icon="isPaused ? ICONS.resume : ICONS.pause"
      tooltip="Pausar / Retomar"
      @click="togglePause"
    />
    <div class="sep" />

    <PillButton
      :icon="ICONS.assert"
      tooltip="Assert"
      :active="assertActive"
      @click="toggleAssertMode"
    />
    <PillButton
      :icon="ICONS.hoverMode"
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
        v-html="ICONS.stop"
      />
      <span class="tooltip">Parar</span>
    </button>
  </div>
</template>
