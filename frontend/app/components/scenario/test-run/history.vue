<script setup lang="ts">
import type { ScenarioRun } from '~/types/project'

interface ScenarioTestRunHistory {
  runs?: ScenarioRun[]
}

const { runs = [] } = defineProps<ScenarioTestRunHistory>()

const emit = defineEmits<{
  open: [run: ScenarioRun]
}>()

function testedAt(run: ScenarioRun) {
  return new Date(run.started_at).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}
</script>

<template>
  <section class="mt-10">
    <p class="mb-3 text-lg font-semibold">
      Testes
    </p>

    <BaseEmpty
      v-if="runs.length === 0"
      icon="i-ic-round-play-circle-outline"
      title="Nenhum teste executado ainda"
      description="Rode o cenário em Testar. Cada execução fica registrada aqui com o resultado e o código que rodou."
      testid="cenario-execucoes-vazio"
    />

    <div
      v-else
      class="grid gap-3 sm:grid-cols-2"
    >
      <UCard
        v-for="run in runs"
        :key="run.started_at"
        class="cursor-pointer transition-colors hover:bg-accented/75"
        data-testid="cenario-execucao"
        :data-status="run.passed ? 'success' : 'failed'"
        @click="emit('open', run)"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="min-w-0">
            <p class="text-sm text-muted">
              Testado em
            </p>
            <p class="truncate">
              {{ testedAt(run) }}
            </p>
          </div>

          <UBadge
            variant="soft"
            :color="run.passed ? 'success' : 'error'"
            :icon="run.passed ? 'i-ic-round-check-circle' : 'i-ic-round-error'"
            :label="run.passed ? 'Sucesso' : 'Falha'"
          />
        </div>
      </UCard>
    </div>
  </section>
</template>
