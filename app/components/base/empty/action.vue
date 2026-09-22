<script setup lang="ts">
interface BaseEmptyAction {
  icon: string
  title: string
  description: string
  testid: string
  disabled?: boolean
}

const {
  icon,
  title,
  description,
  testid,
  disabled = false
} = defineProps<BaseEmptyAction>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <UCard
    :data-testid="testid"
    class="max-w-sm mx-auto transition-colors"
    :class="disabled ? 'opacity-50' : 'cursor-pointer hover:bg-accented/75'"
    @click="!disabled && emit('click')"
  >
    <div class="flex flex-col items-center gap-2">
      <div class="flex size-15 items-center justify-center rounded-lg bg-primary/10">
        <UIcon
          :name="icon"
          class="size-10 text-primary"
        />
      </div>
      <p class="text-lg font-semibold">
        {{ title }}
      </p>
      <p class="text-sm text-muted">
        {{ description }}
      </p>
    </div>
  </UCard>
</template>
