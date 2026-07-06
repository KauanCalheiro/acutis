<script setup lang="ts">
defineOptions({
  inheritAttrs: false
})

interface BaseButtonIcon {
  icon: string
  label: string
  side?: 'top' | 'right' | 'bottom' | 'left'
}

const {
  icon,
  label,
  side = 'top'
} = defineProps<BaseButtonIcon>()
</script>

<template>
  <UTooltip
    :text="label"
    :delay-duration="0"
    arrow
    :content="{
      side
    }"
  >
    <UButton
      :icon="icon"
      :aria-label="label"
      v-bind="$attrs"
    />
  </UTooltip>
</template>
