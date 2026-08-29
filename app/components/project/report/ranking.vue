<script setup lang="ts">
interface RankingItem {
  label: string
  value: number
  display: string
}

interface ProjectReportRanking {
  title: string
  empty: string
  items: RankingItem[]
  tone?: 'primary' | 'error'
  testid: string
}

const { title, empty, items, tone = 'primary', testid } = defineProps<ProjectReportRanking>()

const widest = computed(() => Math.max(...items.map(item => item.value), 1))
</script>

<template>
  <div
    class="rounded-lg bg-elevated p-4"
    :data-testid="testid"
  >
    <p class="mb-3 text-sm font-semibold">
      {{ title }}
    </p>

    <p
      v-if="items.length === 0"
      class="text-sm text-dimmed"
    >
      {{ empty }}
    </p>

    <ul
      v-else
      class="flex flex-col gap-2"
    >
      <li
        v-for="item in items"
        :key="item.label"
        class="flex flex-col gap-1"
      >
        <div class="flex items-baseline justify-between gap-3 text-sm">
          <span class="truncate">{{ item.label }}</span>
          <span class="shrink-0 text-muted tabular-nums">{{ item.display }}</span>
        </div>
        <div class="h-1.5 rounded-full bg-accented">
          <div
            class="h-full rounded-full"
            :class="tone === 'error' ? 'bg-error' : 'bg-primary'"
            :style="{ width: `${Math.max((item.value / widest) * 100, 3)}%` }"
          />
        </div>
      </li>
    </ul>
  </div>
</template>
