<script setup lang="ts">
import type { RecorderEvent } from '~/composables/webdriver'
import { describeRecorderEvent } from '~/utils/recorder-event'

interface ScenarioReviewTimeline {
  events: RecorderEvent[]
  videoSrc?: string | null
  recordingStartedAt?: number | null
  /** Deixa retomar a gravação de qualquer passo, descartando ele e os seguintes. */
  resumable?: boolean
}

const { events, videoSrc = null, recordingStartedAt = null, resumable = false } = defineProps<ScenarioReviewTimeline>()

const emit = defineEmits<{
  resume: [index: number]
}>()

/** Quanto o corte armado espera antes de aceitar a confirmação. */
const ARM_MS = 600

/** Quanto o corte fica armado esperando a confirmação que não vem. */
const ARMED_TIMEOUT_MS = 5000

const videoEl = ref<HTMLVideoElement | null>(null)
const currentTime = ref(0)
const armed = ref<number | null>(null)
const ready = ref(false)

let readyTimer: ReturnType<typeof setTimeout> | undefined
let disarmTimer: ReturnType<typeof setTimeout> | undefined

const eventIcons: Record<string, string> = {
  navigate: 'i-ic-round-public',
  click: 'i-ic-round-ads-click',
  fill: 'i-ic-round-edit',
  submit: 'i-ic-round-send',
  hover: 'i-ic-round-mouse',
  assert: 'i-ic-round-check-circle'
}

function offsetSeconds(event: RecorderEvent): number {
  if (!recordingStartedAt || !event.timestamp) return 0
  return Math.max(0, (event.timestamp - recordingStartedAt) / 1000)
}

const currentIndex = computed(() => {
  let index = -1
  events.forEach((event, i) => {
    if (offsetSeconds(event) <= currentTime.value) index = i
  })
  return index
})

function seekTo(event: RecorderEvent) {
  if (!videoEl.value) return
  const offset = offsetSeconds(event)
  videoEl.value.currentTime = offset
  currentTime.value = offset
}

function disarm() {
  clearTimeout(readyTimer)
  clearTimeout(disarmTimer)
  armed.value = null
  ready.value = false
}

/** O corte pede dois cliques, e o segundo só vale depois da trava de tempo terminar de correr. */
function cut(index: number) {
  if (armed.value === index) {
    if (!ready.value) return

    disarm()
    emit('resume', index)
    return
  }

  disarm()
  armed.value = index
  readyTimer = setTimeout(() => {
    ready.value = true
  }, ARM_MS)
  disarmTimer = setTimeout(disarm, ARMED_TIMEOUT_MS)
}

/** Quantos passos saem da gravação quando o corte armado for confirmado. */
const dropped = computed(() => armed.value === null ? 0 : events.length - armed.value)

onUnmounted(disarm)
</script>

<template>
  <div
    class="grid grid-cols-1 gap-6 lg:grid-cols-5"
    @keydown.esc="disarm"
  >
    <video
      v-if="videoSrc"
      ref="videoEl"
      data-testid="revisao-video"
      :src="videoSrc"
      controls
      class="w-full self-start rounded-lg lg:sticky lg:top-0 lg:col-span-3"
      @timeupdate="currentTime = ($event.target as HTMLVideoElement).currentTime"
    />

    <div :class="videoSrc ? 'lg:col-span-2' : 'lg:col-span-5'">
      <p class="mb-3 font-semibold">
        Timeline dos eventos
      </p>
      <ol class="flex w-max max-w-full flex-col">
        <li
          v-for="(event, i) in events"
          :key="i"
          data-testid="revisao-evento"
          :data-current="i === currentIndex ? 'true' : 'false'"
          :data-dropped="armed !== null && i >= armed ? 'true' : 'false'"
          class="group relative flex cursor-pointer items-stretch gap-3 transition-opacity"
          :class="armed !== null && i >= armed ? 'opacity-50' : ''"
          @click="seekTo(event)"
        >
          <button
            v-if="resumable && i > 0"
            type="button"
            data-testid="revisao-retomar"
            :data-armed="armed === i ? 'true' : 'false'"
            class="absolute -top-5 -right-1.5 -left-1.5 z-10 flex h-4 items-center gap-2 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
            :class="armed === i ? 'opacity-100!' : ''"
            :aria-label="armed === i ? `Confirmar a retomada deste passo, descartando ${dropped}` : 'Retomar a gravação deste passo'"
            @click.stop="cut(i)"
          >
            <span
              class="h-px flex-1 rounded-full"
              :class="armed === i ? 'bg-error' : 'bg-primary'"
            />
            <span
              class="rounded-full px-2 py-0.5 text-[10px] leading-none font-medium tracking-wide uppercase"
              :class="armed === i ? 'bg-error text-inverted' : 'bg-default text-primary'"
            >
              <template v-if="armed !== i">retomar daqui</template>
              <template v-else-if="ready">clique de novo · descarta {{ dropped }}</template>
              <template v-else>aguarde…</template>
            </span>
            <span class="relative h-px flex-1 overflow-visible rounded-full bg-accented">
              <span
                v-if="armed === i"
                class="arming absolute inset-y-0 left-0 rounded-full bg-error"
              />
            </span>
          </button>

          <div class="flex flex-col items-center">
            <UIcon
              :name="eventIcons[event.type!] ?? 'i-ic-round-help-outline'"
              class="size-5 shrink-0 transition-colors"
              :class="i <= currentIndex ? 'text-primary' : 'text-muted'"
            />
            <span
              v-if="i < events.length - 1"
              class="w-px grow transition-colors"
              :class="i < currentIndex ? 'bg-primary' : 'bg-accented'"
            />
          </div>
          <div class="pb-6 min-w-0 flex-1">
            <p
              class="truncate text-sm transition-colors group-hover:text-highlighted"
              :class="[
                i === currentIndex ? 'font-semibold text-primary' : 'text-default',
                armed !== null && i >= armed ? 'line-through decoration-dimmed' : ''
              ]"
            >
              {{ describeRecorderEvent(event) }}
            </p>
            <!-- O instante só existe junto do vídeo: fora da revisão todo evento marcaria 0.0s. -->
            <p
              v-if="recordingStartedAt"
              class="text-xs text-dimmed"
            >
              {{ offsetSeconds(event).toFixed(1) }}s
            </p>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.arming {
  animation: arming 600ms linear forwards;
}

@keyframes arming {
  from { width: 0; }
  to { width: 100%; }
}

@media (prefers-reduced-motion: reduce) {
  .arming { animation-duration: 1ms; width: 100%; }
}
</style>
