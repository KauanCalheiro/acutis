<script setup lang="ts">
interface BaseEmpty {
  icon: string
  title: string
  description?: string
  testid?: string
}

const {
  icon,
  title,
  description = '',
  testid = ''
} = defineProps<BaseEmpty>()
</script>

<template>
  <div
    class="flex flex-col items-center gap-3 py-10 text-center"
    :data-testid="testid"
  >
    <div class="flex size-12 items-center justify-center rounded-lg bg-elevated">
      <UIcon
        :name="icon"
        class="size-7 text-dimmed"
      />
    </div>

    <p class="font-semibold">
      {{ title }}
    </p>

    <p
      v-if="description"
      class="max-w-sm text-sm text-muted"
    >
      {{ description }}
    </p>
  </div>
</template>
