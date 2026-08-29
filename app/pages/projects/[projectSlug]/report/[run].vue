<script setup lang="ts">
import type { ProjectDetail } from '~/types/project'
import type { SuiteRunsResponse, SuiteRunTest } from '#shared/contracts/report'
import { reportUrlFor } from '~/composables/run-stream'

const route = useRoute()
const slug = computed(() => route.params.projectSlug as string)
const startedAt = computed(() => Number(route.params.run))

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

const { data: project } = await useFetch<ProjectDetail>(`/api/projects/${slug.value}`)
const { data } = await useFetch<SuiteRunsResponse>(`/api/projects/${slug.value}/runs`)

const runs = computed(() => data.value?.runs ?? [])
const index = computed(() => runs.value.findIndex(run => Date.parse(run.started_at) === startedAt.value))
const run = computed(() => runs.value[index.value])

/** A rodada seguinte na lista é a anterior no tempo: é com ela que esta se compara. */
const previous = computed(() => index.value === -1 ? undefined : runs.value[index.value + 1])

const isLatest = computed(() => index.value === 0)

function seconds(ms: number) {
  return `${(ms / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}s`
}

function percent(part: number, total: number) {
  const value = total === 0 ? 0 : (part / total) * 100

  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

const when = computed(() => new Date(run.value!.started_at).toLocaleString('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short'
}))

const broken = computed(() => run.value!.tests.filter(test => !test.passed))

/** Do que levou mais tempo para o que levou menos: é assim que se acha onde a rodada demorou. */
const byDuration = computed(() => [...run.value!.tests].sort((a, b) => b.duration_ms - a.duration_ms))

const slowest = computed(() => byDuration.value[0])

const share = computed(() => byDuration.value.map(test => ({
  label: test.title,
  value: test.duration_ms,
  display: `${seconds(test.duration_ms)} · ${percent(test.duration_ms, run.value!.duration_ms)}`
})))

const results = computed(() => [
  {
    label: 'Passaram',
    value: run.value!.totals.passed
  },
  {
    label: 'Falharam',
    value: run.value!.totals.failed
  }
])

/** Quatro cenários nomeados e o resto somado: mais fatias que isso viram confete. */
const timeSlices = computed(() => {
  const top = byDuration.value.slice(0, 4).map(test => ({
    label: test.title,
    value: test.duration_ms
  }))
  const rest = byDuration.value.slice(4)

  if (rest.length === 0) return top

  return [...top, {
    label: `${plural(rest.length, 'outro', 'outros')} ${rest.length} ${plural(rest.length, 'cenário', 'cenários')}`,
    value: rest.reduce((total, test) => total + test.duration_ms, 0)
  }]
})

function runLink(test: SuiteRunTest) {
  return `/projects/${slug.value}/scenarios/${test.id}?tab=execucoes&run=${encodeURIComponent(run.value!.started_at)}`
}

interface Change {
  title: string
  kind: 'quebrou' | 'voltou' | 'novo' | 'saiu'
}

/** O que mudou de uma rodada para a outra: quem quebrou, quem voltou, quem entrou e quem saiu. */
const changes = computed<Change[]>(() => {
  const before = previous.value

  if (!before) return []

  const previousOf = new Map(before.tests.map(test => [test.id, test]))
  const currentOf = new Map(run.value!.tests.map(test => [test.id, test]))

  const moved = run.value!.tests.flatMap<Change>((test) => {
    const was = previousOf.get(test.id)

    if (!was) return [{ title: test.title, kind: 'novo' }]
    if (was.passed === test.passed) return []

    return [{ title: test.title, kind: test.passed ? 'voltou' : 'quebrou' }]
  })

  const gone = before.tests
    .filter(test => !currentOf.has(test.id))
    .map<Change>(test => ({ title: test.title, kind: 'saiu' }))

  return [...moved, ...gone]
})

const changeLabel = {
  quebrou: 'passava e quebrou',
  voltou: 'falhava e voltou a passar',
  novo: 'não estava na rodada anterior',
  saiu: 'ficou de fora desta rodada'
}

const changeTone = {
  quebrou: 'text-error',
  voltou: 'text-success',
  novo: 'text-muted',
  saiu: 'text-muted'
}

const durationDelta = computed(() => previous.value
  ? run.value!.duration_ms - previous.value.duration_ms
  : null)
</script>

<template>
  <UContainer
    :data-hydrated="hydrated"
    class="py-6 lg:py-10"
  >
    <div class="flex items-center gap-2">
      <BaseButtonIcon
        icon="i-ic-round-arrow-back"
        label="Voltar ao relatório"
        color="neutral"
        variant="ghost"
        :to="`/projects/${slug}/report`"
        data-testid="execucao-voltar"
      />
      <h1
        class="truncate text-2xl font-bold"
        data-testid="execucao-titulo"
      >
        <template v-if="run">
          Execução de {{ when }}
        </template>
        <template v-else>
          Execução
        </template>
      </h1>
    </div>

    <BaseEmpty
      v-if="!run"
      class="mt-10"
      icon="i-ic-round-history-toggle-off"
      title="Esta execução não está mais guardada"
      description="O histórico do projeto guarda as 50 rodadas mais recentes. Volte ao relatório para ver as que ainda estão lá."
      testid="execucao-inexistente"
    />

    <template v-else>
      <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-3">
          <UBadge
            :color="run.passed ? 'success' : 'error'"
            :icon="run.passed ? 'i-ic-round-check-circle' : 'i-ic-round-error'"
            :label="run.passed
              ? 'Sucesso'
              : `${run.totals.failed} ${plural(run.totals.failed, 'falhou', 'falharam')}`"
            data-testid="execucao-status"
          />
          <p
            class="flex min-w-0 flex-wrap items-center gap-x-1.5 text-muted"
            data-testid="execucao-contexto"
          >
            <span>{{ project?.name }}</span>
            <span>·</span>
            <UTooltip
              v-if="run.filter"
              :delay-duration="0"
              :text="run.filter"
            >
              <span class="underline decoration-dotted underline-offset-4">
                filtro com {{ run.totals.tests }} {{ plural(run.totals.tests, 'cenário', 'cenários') }}
              </span>
            </UTooltip>
            <span v-else>o projeto inteiro</span>
            <template v-if="run.branch">
              <span>·</span>
              <span>{{ run.branch }}</span>
            </template>
            <template v-if="run.author">
              <span>·</span>
              <span>{{ run.author }}</span>
            </template>
          </p>
        </div>

        <BaseButtonIcon
          v-if="isLatest"
          icon="i-ic-round-assessment"
          label="Abrir o relatório do Playwright, com vídeo e trace. Ele guarda só a execução mais recente, que é esta."
          color="neutral"
          variant="soft"
          :to="reportUrlFor(slug)"
          target="_blank"
          external
          data-testid="execucao-playwright"
        />
      </div>

      <div class="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <ProjectReportMetric
          name="cenarios"
          label="Cenários"
          :value="`${run.totals.passed}/${run.totals.tests}`"
          :tone="run.passed ? 'success' : 'error'"
          :hint="counted(run.totals.failed, 'falhou', 'falharam', 'nenhum falhou')"
        />
        <ProjectReportMetric
          name="sucesso"
          label="Sucesso"
          :value="percent(run.totals.passed, run.totals.tests)"
        />
        <ProjectReportMetric
          name="duracao"
          label="Duração"
          :value="seconds(run.duration_ms)"
          :hint="durationDelta === null
            ? 'sem rodada anterior para comparar'
            : `${durationDelta >= 0 ? '+' : '-'}${seconds(Math.abs(durationDelta))} contra a anterior`"
        />
        <ProjectReportMetric
          name="steps"
          label="Steps"
          :value="`${run.totals.steps}`"
          :hint="`${(run.totals.steps / Math.max(run.totals.tests, 1)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} por cenário`"
        />
        <ProjectReportMetric
          name="mais-lento"
          label="Mais lento"
          :value="slowest ? seconds(slowest.duration_ms) : '—'"
          :hint="slowest?.title ?? ''"
        />
      </div>

      <section
        v-if="broken.length"
        class="mt-4 rounded-lg bg-elevated p-4"
      >
        <p class="mb-3 text-sm font-semibold">
          O que quebrou
        </p>

        <ul class="flex flex-col gap-2">
          <li
            v-for="test in broken"
            :key="test.id"
            class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-default pb-2 last:border-0 last:pb-0"
            data-testid="execucao-quebrou"
          >
            <span>
              {{ test.title }}
              <span class="text-muted"> · {{ test.failed_step ?? 'sem passo reportado' }}</span>
            </span>
            <NuxtLink
              :to="runLink(test)"
              class="shrink-0 text-primary hover:underline"
            >
              Ver o erro e o vídeo →
            </NuxtLink>
          </li>
        </ul>
      </section>

      <div class="mt-4 grid gap-3 lg:grid-cols-2">
        <ProjectReportDonut
          title="Resultado dos cenários"
          :slices="results"
          palette="resultado"
          :center="percent(run.totals.passed, run.totals.tests)"
          center-label="passaram"
          testid="execucao-donut-resultado"
        />
        <ProjectReportDonut
          title="Onde o tempo foi gasto"
          :slices="timeSlices"
          :center="seconds(run.duration_ms)"
          center-label="no total"
          :format="seconds"
          testid="execucao-donut-tempo"
        />

        <ProjectReportRanking
          title="Duração por cenário"
          empty="Nenhum cenário rodou."
          :items="share"
          testid="execucao-tempo"
        />

        <div
          class="rounded-lg bg-elevated p-4"
          data-testid="execucao-comparacao"
        >
          <p class="mb-3 text-sm font-semibold">
            Contra a rodada anterior
          </p>

          <p
            v-if="!previous"
            class="text-sm text-dimmed"
          >
            Esta é a rodada mais antiga que o histórico guarda.
          </p>

          <template v-else>
            <p class="mb-3 text-sm text-muted tabular-nums">
              {{ durationDelta !== null && durationDelta >= 0 ? 'Levou' : 'Economizou' }}
              {{ seconds(Math.abs(durationDelta ?? 0)) }}
              {{ durationDelta !== null && durationDelta >= 0 ? 'a mais' : 'a menos' }}
              que a de {{ new Date(previous.started_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) }},
              que levou {{ seconds(previous.duration_ms) }}.
            </p>

            <p
              v-if="changes.length === 0"
              class="text-sm text-dimmed"
            >
              Mesmos cenários, mesmos resultados.
            </p>
            <ul
              v-else
              class="flex flex-col gap-2 text-sm"
            >
              <li
                v-for="change in changes"
                :key="`${change.kind}-${change.title}`"
                class="flex flex-wrap items-baseline gap-x-2"
              >
                <span class="truncate">{{ change.title }}</span>
                <span :class="changeTone[change.kind]">{{ changeLabel[change.kind] }}</span>
              </li>
            </ul>
          </template>
        </div>
      </div>

      <h2 class="mt-10 mb-3 text-lg font-semibold">
        Cenários da rodada
      </h2>

      <div class="overflow-x-auto rounded-lg bg-elevated px-4 py-3">
        <table class="w-full text-sm">
          <thead class="text-xs uppercase tracking-wide text-dimmed">
            <tr>
              <th class="py-1 text-left font-normal">
                Cenário
              </th>
              <th class="py-1 text-center font-normal">
                Status
              </th>
              <th class="py-1 px-3 text-center font-normal">
                Steps
              </th>
              <th class="py-1 px-3 text-center font-normal">
                Duração
              </th>
              <th class="py-1 px-3 text-center font-normal">
                Fatia do tempo
              </th>
              <th class="py-1 pl-4 text-center font-normal">
                Passo que quebrou
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="test in byDuration"
              :key="test.id"
              class="border-t border-default"
              data-testid="execucao-teste"
            >
              <td class="py-2 pr-3">
                {{ test.title }}
              </td>
              <td class="py-2 pr-3 text-center">
                <UBadge
                  size="sm"
                  variant="solid"
                  :color="test.passed ? 'success' : 'error'"
                  :label="test.passed ? 'Passou' : 'Falhou'"
                />
              </td>
              <td class="py-2 px-3 text-center tabular-nums">
                {{ test.steps }}
              </td>
              <td class="py-2 px-3 text-center tabular-nums">
                {{ seconds(test.duration_ms) }}
              </td>
              <td class="py-2 px-3 text-center tabular-nums">
                {{ percent(test.duration_ms, run.duration_ms) }}
              </td>
              <td class="py-2 pl-4 text-center">
                <NuxtLink
                  v-if="!test.passed"
                  :to="runLink(test)"
                  class="text-primary hover:underline"
                  data-testid="execucao-teste-link"
                >
                  {{ test.failed_step ?? 'Ver a execução' }} →
                </NuxtLink>
                <span
                  v-else
                  class="text-dimmed"
                >—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </UContainer>
</template>
