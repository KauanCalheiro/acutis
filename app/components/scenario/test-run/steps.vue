<script setup lang="ts">
import type { RunStep } from '~/composables/run-stream'

interface ScenarioTestRunSteps {
  steps?: RunStep[]
}

const {
  steps = []
} = defineProps<ScenarioTestRunSteps>()

const stepIcons: Record<RunStep['status'], string> = {
  waiting: 'i-ic-round-radio-button-unchecked',
  running: 'line-md:loading-twotone-loop',
  success: 'i-ic-round-check-circle',
  failed: 'i-ic-round-error'
}

const stepColors: Record<RunStep['status'], string> = {
  waiting: 'text-dimmed',
  running: 'text-neutral',
  success: 'text-success',
  failed: 'text-error'
}
</script>

<template>
  <ol class="flex flex-col">
    <li
      v-for="(step, i) in steps"
      :key="i"
      data-testid="execucao-step"
      :data-status="step.status"
      class="flex items-stretch gap-3 pb-4 last:pb-0"
    >
      <div class="flex flex-col items-center">
        <UIcon
          :name="stepIcons[step.status]"
          class="size-6 shrink-0 transition-colors"
          :class="stepColors[step.status]"
        />
        <span
          v-if="i < steps.length - 1"
          class="w-px grow min-h-4 -mb-4 bg-inverted/30"
        />
      </div>
      <div class="min-w-0">
        <p
          class="text-base"
          data-testid="execucao-step-titulo"
        >
          {{ step.title }}
        </p>
        <p
          v-if="step.status === 'failed' && step.error"
          class="text-sm text-dimmed mt-1"
          data-testid="execucao-step-erro"
        >
          <span class="font-semibold text-error">Erro:</span> {{ step.error }}
        </p>
      </div>
    </li>
  </ol>
</template>
