<script setup lang="ts">
defineProps<{
  icon: string
  tooltip: string
  active?: boolean
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
  emit("click")
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
      v-html="icon"
    />
    <span class="tooltip">{{ tooltip }}</span>
  </button>
</template>
