<script setup lang="ts">
import type { ProjectDetail } from '~/types/project'
import type { SuiteRunsResponse } from '#shared/contracts/report'
import { reportUrlFor } from '~/composables/run-stream'
import { scenarioStats, summarizeRuns } from '~/utils/report'

const route = useRoute()
const slug = computed(() => route.params.projectSlug as string)

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

const { data: project } = await useFetch<ProjectDetail>(`/api/projects/${slug.value}`)
const { data } = await useFetch<SuiteRunsResponse>(`/api/projects/${slug.value}/runs`)

const runs = computed(() => data.value?.runs ?? [])
const summary = computed(() => summarizeRuns(runs.value))
const stats = computed(() => scenarioStats(runs.value))

/** Quantas rodadas os gráficos desenham: além disto a barra some e a linha vira serrote. */
const PLOTTED = 30

/** Quantas execuções a lista mostra por página. */
const PAGE_SIZE = 10

const plotted = computed(() => [...runs.value].slice(0, PLOTTED).reverse())

const page = ref(1)
const paginated = computed(() => runs.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))

function seconds(ms: number) {
  return `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`
}

const last = computed(() => runs.value[0])

/** Hora e dia: as rodadas costumam ser do mesmo dia, e só a data faria todas iguais. */
function when(startedAt: string) {
  return new Date(startedAt).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

const resultColumns = computed(() => plotted.value.map(run => ({
  label: when(run.started_at),
  passed: run.totals.passed,
  failed: run.totals.failed
})))

const durationPoints = computed(() => plotted.value.map(run => ({
  label: when(run.started_at),
  value: run.duration_ms,
  display: seconds(run.duration_ms)
})))

const longest = computed(() => Math.max(...runs.value.map(run => run.duration_ms), 0))

const mostFailed = computed(() => stats.value
  .filter(stat => stat.failures > 0)
  .slice(0, 5)
  .map(stat => ({
    label: stat.title,
    value: stat.failures,
    display: `${stat.failures} de ${stat.runs} · ${stat.failureRate}%`
  })))

const slowest = computed(() => [...stats.value]
  .sort((a, b) => b.averageDurationMs - a.averageDurationMs)
  .slice(0, 5)
  .map(stat => ({
    label: stat.title,
    value: stat.averageDurationMs,
    display: seconds(stat.averageDurationMs)
  })))
</script>

<template>
  <UContainer
    :data-hydrated="hydrated"
    class="py-6 lg:py-10"
  >
    <div class="flex items-start justify-between gap-4">
      <div class="flex flex-col gap-1 min-w-0">
        <div class="flex items-center gap-2">
          <BaseButtonIcon
            icon="i-ic-round-arrow-back"
            label="Voltar ao projeto"
            color="neutral"
            variant="ghost"
            :to="`/projects/${slug}`"
            data-testid="relatorio-voltar"
          />
          <h1 class="text-2xl font-bold truncate">
            Relatório de {{ project?.name }}
          </h1>
        </div>
        <p class="text-muted">
          O que as últimas execuções agrupadas deste projeto contam.
        </p>
      </div>

      <BaseButtonIcon
        v-if="runs.length"
        icon="i-ic-round-assessment"
        label="Abrir o relatório do Playwright, com vídeo e trace. Ele guarda só a execução mais recente, a de cima na lista."
        color="neutral"
        variant="soft"
        :to="reportUrlFor(slug)"
        target="_blank"
        external
        data-testid="relatorio-playwright"
      />
    </div>

    <BaseEmpty
      v-if="runs.length === 0"
      class="mt-10"
      icon="i-ic-round-insert-chart-outlined"
      title="Nenhuma execução agrupada ainda"
      description="Rode os cenários filtrados na tela do projeto. Cada rodada entra aqui com o resultado, a duração e os cenários que falharam."
      testid="relatorio-vazio"
    />

    <template v-else>
      <div class="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ProjectReportMetric
          name="ultima"
          label="Última rodada"
          :value="`${last!.totals.passed}/${last!.totals.tests}`"
          :tone="last!.passed ? 'success' : 'error'"
          :hint="`${new Date(last!.started_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ${seconds(last!.duration_ms)}`"
        />
        <ProjectReportMetric
          name="sucesso-rodadas"
          label="Rodadas verdes"
          :value="`${summary.successRate}%`"
          :hint="`${summary.runs} ${plural(summary.runs, 'rodada guardada', 'rodadas guardadas')}`"
        />
        <ProjectReportMetric
          name="sucesso-cenarios"
          label="Cenários verdes"
          :value="`${summary.testSuccessRate}%`"
          :hint="`${summary.totalSteps} ${plural(summary.totalSteps, 'step', 'steps')} · ${summary.averageSteps.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por cenário`"
        />
        <ProjectReportMetric
          name="duracao"
          label="Duração média"
          :value="seconds(summary.averageDurationMs)"
          :hint="`rodada mais longa: ${seconds(longest)}`"
        />
        <ProjectReportMetric
          name="instaveis"
          :label="plural(summary.flaky, 'Cenário instável', 'Cenários instáveis')"
          :value="`${summary.flaky}`"
          :tone="summary.flaky > 0 ? 'error' : 'neutral'"
          :hint="summary.flaky === 0
            ? 'nenhum trocou de resultado entre rodadas'
            : plural(summary.flaky, 'trocou de resultado entre rodadas', 'trocaram de resultado entre rodadas')"
        />
      </div>

      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        <ProjectReportStacked
          :title="`Resultado das últimas ${resultColumns.length} rodadas`"
          legend="verde passou, vermelho falhou"
          :columns="resultColumns"
          testid="relatorio-resultado"
        />
        <ProjectReportTrend
          :title="`Duração das últimas ${durationPoints.length} rodadas`"
          :points="durationPoints"
          testid="relatorio-duracao"
        />
        <ProjectReportRanking
          title="Cenários que mais falham"
          empty="Nenhum cenário falhou nas rodadas guardadas."
          tone="error"
          :items="mostFailed"
          testid="relatorio-ranking-falhas"
        />
        <ProjectReportRanking
          title="Cenários mais lentos"
          empty="Sem execução para medir."
          :items="slowest"
          testid="relatorio-ranking-lentos"
        />
      </div>

      <ProjectReportMatrix
        class="mt-4"
        :stats="stats"
        :rounds="PLOTTED"
      />

      <h2 class="mt-10 mb-3 text-lg font-semibold">
        Execuções
      </h2>

      <ProjectReportRuns
        :runs="paginated"
        :slug="slug"
      />

      <div
        v-if="runs.length > PAGE_SIZE"
        class="mt-4 flex justify-center"
      >
        <UPagination
          v-model:page="page"
          variant="soft"
          :total="runs.length"
          :items-per-page="PAGE_SIZE"
          data-testid="relatorio-paginacao"
        />
      </div>
    </template>
  </UContainer>
</template>
