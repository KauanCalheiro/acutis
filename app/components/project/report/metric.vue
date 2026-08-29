<script setup lang="ts">
interface ProjectReportMetric {
  name: string
  label: string
  value: string
  hint?: string
  tone?: 'neutral' | 'success' | 'error'
}

const {
  name,
  label,
  value,
  hint = '',
  tone = 'neutral'
} = defineProps<ProjectReportMetric>()

const toneClass = {
  neutral: 'text-highlighted',
  success: 'text-success',
  error: 'text-error'
}
</script>

<template>
  <div
    class="rounded-lg bg-elevated px-4 py-3"
    :data-metrica="name"
  >
    <p class="text-xs uppercase tracking-wide text-dimmed">
      {{ label }}
    </p>
    <p
      class="text-2xl font-semibold tabular-nums"
      :class="toneClass[tone]"
    >
      {{ value }}
    </p>
    <p
      v-if="hint"
      class="text-xs text-muted"
    >
      {{ hint }}
    </p>
  </div>
</template>
