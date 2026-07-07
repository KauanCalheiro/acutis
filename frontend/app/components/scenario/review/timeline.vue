<script setup lang="ts">
import type { RecorderEvent } from '~/composables/webdriver'

interface ScenarioReviewTimeline {
  events: RecorderEvent[]
  videoSrc?: string | null
  recordingStartedAt?: number | null
}

const { events, videoSrc = null, recordingStartedAt = null } = defineProps<ScenarioReviewTimeline>()

const videoEl = ref<HTMLVideoElement | null>(null)
const currentTime = ref(0)

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

function describe(event: RecorderEvent): string {
  const selector = event.selectors
  return event.label || selector?.text || selector?.dataTestId || selector?.cssStable || event.url || event.type || ''
}

function seekTo(event: RecorderEvent) {
  if (!videoEl.value) return
  const offset = offsetSeconds(event)
  videoEl.value.currentTime = offset
  currentTime.value = offset
}
</script>

<template>
  <div class="grid grid-cols-1 gap-6 lg:grid-cols-5">
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
      <ol class="flex flex-col">
        <li
          v-for="(event, i) in events"
          :key="i"
          data-testid="revisao-evento"
          :data-current="i === currentIndex ? 'true' : 'false'"
          class="group flex cursor-pointer items-stretch gap-3"
          @click="seekTo(event)"
        >
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
          <div class="pb-4 min-w-0">
            <p
              class="truncate text-sm transition-colors group-hover:text-highlighted"
              :class="i === currentIndex ? 'font-semibold text-primary' : 'text-default'"
            >
              {{ describe(event) }}
              <template v-if="event.value">
                = {{ event.value }}
              </template>
            </p>
            <p class="text-xs text-dimmed">
              {{ event.type }} · {{ offsetSeconds(event).toFixed(1) }}s
            </p>
          </div>
        </li>
      </ol>
    </div>
  </div>
</template>
