<script setup lang="ts">
interface Point {
  label: string
  value: number
  display: string
}

interface ProjectReportTrend {
  title: string
  legend?: string
  /** Um ponto por rodada, da mais antiga para a mais recente. */
  points: Point[]
  testid: string
}

const { title, legend = '', points, testid } = defineProps<ProjectReportTrend>()

const WIDTH = 100
const HEIGHT = 40

const highest = computed(() => Math.max(...points.map(point => point.value), 1))

const coordinates = computed(() => points.map((point, index) => ({
  x: points.length === 1 ? WIDTH / 2 : (index / (points.length - 1)) * WIDTH,
  y: HEIGHT - (point.value / highest.value) * (HEIGHT - 4) - 2,
  point
})))

const line = computed(() => coordinates.value.map(({ x, y }) => `${x},${y}`).join(' '))

const area = computed(() => `${coordinates.value[0]?.x ?? 0},${HEIGHT} ${line.value} ${coordinates.value.at(-1)?.x ?? 0},${HEIGHT}`)

/** Muitos pontos viram confete em cima da linha: aí só a última rodada fica marcada. */
const dots = computed(() => coordinates.value.length > 20
  ? coordinates.value.slice(-1)
  : coordinates.value)
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

    <div class="relative h-28">
      <svg
        :viewBox="`0 0 ${WIDTH} ${HEIGHT}`"
        preserveAspectRatio="none"
        class="size-full"
        role="img"
        :aria-label="title"
      >
        <line
          v-for="grid in [0.25, 0.5, 0.75]"
          :key="grid"
          x1="0"
          x2="100"
          :y1="HEIGHT * grid"
          :y2="HEIGHT * grid"
          class="stroke-accented"
          stroke-width="1"
          vector-effect="non-scaling-stroke"
        />
        <polygon
          :points="area"
          class="fill-primary/10"
        />
        <polyline
          :points="line"
          fill="none"
          class="stroke-primary"
          stroke-width="2"
          stroke-linejoin="round"
          vector-effect="non-scaling-stroke"
        />
      </svg>

      <UTooltip
        v-for="({ x, y, point }, index) in dots"
        :key="index"
        :delay-duration="0"
        :text="`${point.label}: ${point.display}`"
      >
        <span
          class="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary ring-2 ring-elevated"
          :style="{ left: `${x}%`, top: `${(y / HEIGHT) * 100}%` }"
        />
      </UTooltip>
    </div>

    <div class="mt-2 flex justify-between text-xs text-dimmed tabular-nums">
      <span>{{ points[0]?.label }} · {{ points[0]?.display }}</span>
      <span>{{ points.at(-1)?.label }} · {{ points.at(-1)?.display }}</span>
    </div>
  </div>
</template>
