<script setup lang="ts">
interface Column {
  label: string
  passed: number
  failed: number
}

interface ProjectReportStacked {
  title: string
  legend?: string
  /** Uma coluna por rodada, da mais antiga para a mais recente. */
  columns: Column[]
  testid: string
}

const { title, legend = '', columns, testid } = defineProps<ProjectReportStacked>()

const tallest = computed(() => Math.max(...columns.map(column => column.passed + column.failed), 1))

function height(value: number) {
  return `${(value / tallest.value) * 100}%`
}
</script>

<template>
  <div
    class="rounded-lg bg-elevated p-4"
    :data-testid="testid"
  >
    <div class="mb-3 flex items-baseline justify-between gap-2">
      <p class="text-sm font-semibold">
        {{ title }}
      </p>
      <p
        v-if="legend"
        class="text-xs text-dimmed"
      >
        {{ legend }}
      </p>
    </div>

    <div class="flex h-28 items-end gap-1.5">
      <UTooltip
        v-for="(column, index) in columns"
        :key="index"
        :delay-duration="0"
        :text="`${column.label}: ${counted(column.passed, 'passou', 'passaram', 'nenhum passou')}, ${counted(column.failed, 'falhou', 'falharam', 'nenhum falhou')}`"
      >
        <div class="flex h-full flex-1 flex-col justify-end gap-0.5">
          <div
            v-if="column.failed"
            class="rounded-t-sm bg-error/80"
            :style="{ height: height(column.failed) }"
          />
          <div
            v-if="column.passed"
            class="bg-success/80"
            :class="column.failed ? '' : 'rounded-t-sm'"
            :style="{ height: height(column.passed) }"
          />
        </div>
      </UTooltip>
    </div>

    <div class="mt-2 flex justify-between text-xs text-dimmed tabular-nums">
      <span>{{ columns[0]?.label }}</span>
      <span>{{ columns.at(-1)?.label }}</span>
    </div>
  </div>
</template>
