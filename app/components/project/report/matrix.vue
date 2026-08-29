<script setup lang="ts">
import type { ScenarioStat } from '~/utils/report'

interface ProjectReportMatrix {
  stats: ScenarioStat[]
  /** Quantas rodadas a grade mostra, da mais recente para trás. */
  rounds?: number
  /** Quantos cenários entram na grade; os que sobram viram uma linha de rodapé. */
  limit?: number
}

const { stats, rounds = 30, limit = 15 } = defineProps<ProjectReportMatrix>()

const lines = computed(() => stats.slice(0, limit).map(stat => ({
  ...stat,
  history: stat.history.slice(-rounds)
})))

const hidden = computed(() => Math.max(stats.length - limit, 0))

const cell = {
  true: 'bg-success/70',
  false: 'bg-error/70',
  null: 'bg-accented'
}

function tone(passed: boolean | null) {
  return cell[String(passed) as keyof typeof cell]
}

function title(passed: boolean | null) {
  if (passed === null) return 'Não rodou'

  return passed ? 'Passou' : 'Falhou'
}
</script>

<template>
  <div
    class="rounded-lg bg-elevated p-4"
    data-testid="relatorio-matriz"
  >
    <div class="mb-3 flex items-baseline justify-between gap-2">
      <p class="text-sm font-semibold">
        {{ hidden ? `Os ${lines.length} cenários que mais falham` : 'Cenário' }}
        nas últimas {{ lines[0]?.history.length ?? 0 }} rodadas
      </p>
      <p class="text-xs text-dimmed">
        cinza é rodada em que ele ficou de fora
      </p>
    </div>

    <div class="flex flex-col gap-2">
      <div
        v-for="stat in lines"
        :key="stat.id"
        class="flex items-center gap-3"
        data-testid="relatorio-matriz-linha"
      >
        <UTooltip
          :delay-duration="0"
          :text="stat.title"
          class="w-56 shrink-0"
        >
          <span class="block truncate text-sm">{{ stat.title }}</span>
        </UTooltip>
        <span
          v-if="stat.failures"
          class="w-40 shrink-0 text-xs text-error tabular-nums"
        >
          {{ stat.failures }} de {{ stat.runs }} {{ plural(stat.failures, 'falhou', 'falharam') }}
        </span>
        <span
          v-else
          class="w-40 shrink-0"
        />
        <span class="flex flex-1 justify-end gap-1 overflow-x-auto">
          <UTooltip
            v-for="(passed, index) in stat.history"
            :key="index"
            :delay-duration="0"
            :text="title(passed)"
          >
            <span
              class="block size-4 rounded-xs"
              :class="tone(passed)"
            />
          </UTooltip>
        </span>
      </div>

      <p
        v-if="hidden"
        class="text-xs text-dimmed"
      >
        {{ plural(hidden, 'outro', 'outros') }} {{ hidden }}
        {{ plural(hidden, 'cenário ficou', 'cenários ficaram') }} de fora da grade.
      </p>
    </div>
  </div>
</template>
