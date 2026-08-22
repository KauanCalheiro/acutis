<script setup lang="ts">
import PillIcon from './PillIcon.vue'
import type { PillIconName } from './pillIcon'

defineProps<{
  icon: PillIconName
  tooltip: string
  active?: boolean
  /** A ação deste botão acabou de virar passo: o ícone dá lugar ao check e depois volta. */
  confirmed?: boolean
  extraClass?: string
}>()

const emit = defineEmits<{ click: [] }>()

function handleMousedown(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
}

function handleClick(e: MouseEvent) {
  e.stopPropagation()
  e.preventDefault()
  emit('click')
}
</script>

<template>
  <button
    class="btn"
    :class="[extraClass, { active }]"
    @mousedown="handleMousedown"
    @click="handleClick"
  >
    <span
      class="icon"
      :class="{ confirmed }"
    >
      <PillIcon
        :name="confirmed ? 'checked' : icon"
        :size="14"
      />
    </span>
    <span class="tooltip">{{ tooltip }}</span>
  </button>
</template>
