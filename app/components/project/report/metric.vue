<script setup lang="ts">
import { UTooltip } from '#components'

interface ProjectReportMetric {
  name: string
  label: string
  value: string
  hint?: string
  /** O que o número significa, para quem não conhece o termo; sai no tooltip do card. */
  explanation?: string
  tone?: 'neutral' | 'success' | 'error'
}

const {
  name,
  label,
  value,
  hint = '',
  explanation = '',
  tone = 'neutral'
} = defineProps<ProjectReportMetric>()

/** Sem explicação o card não vira gatilho de tooltip: fica a div simples de antes. */
const wrapper = computed(() => explanation ? UTooltip : 'div')

const tooltipUi = WRAPPED_TOOLTIP

const toneClass = {
  neutral: 'text-highlighted',
  success: 'text-success',
  error: 'text-error'
}
</script>

<template>
  <component
    :is="wrapper"
    :text="explanation || undefined"
    :delay-duration="150"
    :ui="tooltipUi"
  >
    <div
      class="rounded-lg bg-elevated px-4 py-3"
      :class="explanation && 'cursor-help'"
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
  </component>
</template>
