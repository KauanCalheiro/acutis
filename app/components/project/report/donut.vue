<script setup lang="ts">
interface Slice {
  label: string
  value: number
}

interface ProjectReportDonut {
  title: string
  slices: Slice[]
  palette?: 'tempo' | 'resultado'
  /** O número grande no meio do anel. */
  center?: string
  centerLabel?: string
  format?: (value: number) => string
  testid: string
}

const {
  title,
  slices,
  palette = 'tempo',
  center = '',
  centerLabel = '',
  format = (value: number) => `${value}`,
  testid
} = defineProps<ProjectReportDonut>()

/** Classe escrita por extenso: montada em runtime, o Tailwind não a enxerga e a fatia sai cinza. */
const PALETTES = {
  tempo: [
    { ring: 'stroke-primary', dot: 'bg-primary' },
    { ring: 'stroke-primary/70', dot: 'bg-primary/70' },
    { ring: 'stroke-primary/50', dot: 'bg-primary/50' },
    { ring: 'stroke-primary/35', dot: 'bg-primary/35' },
    { ring: 'stroke-primary/20', dot: 'bg-primary/20' }
  ],
  resultado: [
    { ring: 'stroke-success', dot: 'bg-success' },
    { ring: 'stroke-error', dot: 'bg-error' }
  ]
}

const RADIUS = 15.9155
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const total = computed(() => slices.reduce((sum, slice) => sum + slice.value, 0))

/** Cada anel começa onde o anterior parou, girando no sentido do relógio a partir do topo. */
const rings = computed(() => {
  let offset = 0

  return slices.map((slice, index) => {
    const share = total.value === 0 ? 0 : slice.value / total.value
    const tones = PALETTES[palette]
    const ring = {
      ...slice,
      share,
      tone: tones[index % tones.length]!,
      dash: `${share * CIRCUMFERENCE} ${CIRCUMFERENCE}`,
      offset: -offset * CIRCUMFERENCE
    }

    offset += share

    return ring
  })
})

function percent(share: number) {
  return `${(share * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}
</script>

<template>
  <div
    class="rounded-lg bg-elevated p-4"
    :data-testid="testid"
  >
    <p class="mb-3 text-sm font-semibold">
      {{ title }}
    </p>

    <div class="flex flex-wrap items-center gap-5">
      <div class="relative size-36 shrink-0">
        <svg
          viewBox="0 0 40 40"
          class="size-full -rotate-90"
          role="img"
          :aria-label="title"
        >
          <circle
            cx="20"
            cy="20"
            :r="RADIUS"
            fill="none"
            class="stroke-accented"
            stroke-width="6"
          />
          <circle
            v-for="ring in rings"
            :key="ring.label"
            cx="20"
            cy="20"
            :r="RADIUS"
            fill="none"
            :class="ring.tone.ring"
            stroke-width="6"
            :stroke-dasharray="ring.dash"
            :stroke-dashoffset="ring.offset"
          />
        </svg>

        <div
          v-if="center"
          class="absolute inset-0 flex flex-col items-center justify-center"
        >
          <span class="text-xl font-semibold tabular-nums">{{ center }}</span>
          <span
            v-if="centerLabel"
            class="text-xs text-dimmed"
          >{{ centerLabel }}</span>
        </div>
      </div>

      <ul class="flex min-w-0 grow flex-col gap-1.5 text-sm">
        <li
          v-for="ring in rings"
          :key="ring.label"
          class="flex items-center gap-2"
        >
          <span
            class="size-2.5 shrink-0 rounded-xs"
            :class="ring.tone.dot"
          />
          <span class="min-w-0 grow truncate">{{ ring.label }}</span>
          <span class="shrink-0 text-muted tabular-nums">
            {{ format(ring.value) }} · {{ percent(ring.share) }}
          </span>
        </li>
      </ul>
    </div>
  </div>
</template>
