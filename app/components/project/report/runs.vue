<script setup lang="ts">
import type { SuiteRun } from '#shared/contracts/report'

interface ProjectReportRuns {
  runs: SuiteRun[]
  slug: string
}

const { runs, slug } = defineProps<ProjectReportRuns>()

function startedAt(run: SuiteRun) {
  return new Date(run.started_at).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short'
  })
}

function seconds(ms: number) {
  return `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <NuxtLink
      v-for="run in runs"
      :key="run.started_at"
      :to="`/projects/${slug}/report/${Date.parse(run.started_at)}`"
      class="flex items-center gap-3 rounded-lg bg-elevated px-4 py-3 transition-colors hover:bg-accented/75"
      data-testid="relatorio-execucao"
      :data-status="run.passed ? 'success' : 'failed'"
    >
      <span
        class="h-8 w-1 shrink-0 rounded-full"
        :class="run.passed ? 'bg-success' : 'bg-error'"
      />
      <span class="min-w-0 grow">
        <span class="block truncate">
          {{ startedAt(run) }}
          <span class="text-muted">
            ·
            <template v-if="run.filter">
              {{ run.totals.tests }}
              {{ plural(run.totals.tests, 'cenário filtrado', 'cenários filtrados') }}
            </template>
            <template v-else>o projeto inteiro</template>
            <template v-if="run.branch"> · {{ run.branch }}</template>
          </span>
        </span>
        <span class="block text-sm text-muted tabular-nums">
          <span :class="run.totals.failed ? 'text-error' : 'text-success'">
            {{ run.totals.passed }} de {{ run.totals.tests }}
            {{ plural(run.totals.passed, 'passou', 'passaram') }}
          </span>
          · {{ seconds(run.duration_ms) }} ·
          {{ run.totals.steps }} {{ plural(run.totals.steps, 'step', 'steps') }}
        </span>
      </span>
      <UIcon
        name="i-ic-round-chevron-right"
        class="size-5 shrink-0 text-dimmed"
      />
    </NuxtLink>
  </div>
</template>
