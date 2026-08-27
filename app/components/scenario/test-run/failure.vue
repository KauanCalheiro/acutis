<script setup lang="ts">
import { describeRunFailure } from '~/utils/run-failure'

interface ScenarioTestRunFailure {
  error: string
}

const { error } = defineProps<ScenarioTestRunFailure>()

const failure = computed(() => describeRunFailure(error))
</script>

<template>
  <div
    v-if="failure"
    class="mt-1 text-sm"
  >
    <p data-testid="execucao-step-erro">
      <span class="font-semibold text-error">Erro:</span> {{ failure.summary }}
    </p>

    <p
      v-if="failure.hint"
      class="mt-0.5 text-dimmed"
      data-testid="execucao-step-dica"
    >
      {{ failure.hint }}
    </p>

    <details class="mt-1">
      <summary class="cursor-pointer text-xs text-dimmed">
        Mensagem do Playwright
      </summary>
      <code
        class="mt-1 block whitespace-pre-wrap font-mono text-xs text-dimmed"
        data-testid="execucao-step-erro-cru"
      >{{ error }}</code>
    </details>
  </div>
</template>
