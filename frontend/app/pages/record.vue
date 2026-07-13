<script setup lang="ts">
import type { RecorderEvent } from '~/composables/webdriver'

const hydrated = ref(false)
onMounted(() => {
  hydrated.value = true
})

const { state, url: WEBDRIVER_URL, startRecording: start, stopRecording: stop } = useWebdriver()

const wsConnected = computed(() => state.value.connected)
const extensionReady = computed(() => state.value.extensionReady)
const recording = computed(() => state.value.recording)
const errorMsg = computed(() => state.value.error)
const videoSessionId = computed(() => state.value.videoSessionId)
const events = computed(() => [...state.value.events].reverse())
const videoEl = ref<HTMLVideoElement | null>(null)

function describe(e: RecorderEvent): string {
  const s = e.selectors
  return s?.dataTestId || s?.text || s?.cssStable || e.label || e.url || ''
}

function videoOffsetSeconds(e: RecorderEvent): number | null {
  if (!state.value.recordingStartedAt || !e.timestamp) return null
  return (e.timestamp - state.value.recordingStartedAt) / 1000
}

function seekTo(e: RecorderEvent): void {
  const offset = videoOffsetSeconds(e)
  if (offset === null || !videoEl.value) return
  videoEl.value.currentTime = Math.max(0, offset)
}
</script>

<template>
  <UContainer
    class="py-8 space-y-6"
    :data-hydrated="hydrated"
  >
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Gravação
      </h1>
      <div class="flex items-center gap-2">
        <UBadge
          :color="wsConnected ? 'success' : 'neutral'"
        >
          {{ wsConnected ? 'Webdriver conectado' : 'Webdriver offline' }}
        </UBadge>
        <UBadge
          :color="extensionReady ? 'success' : 'error'"
        >
          {{ extensionReady ? 'Sessão pronta' : 'Aguardando webdriver' }}
        </UBadge>
      </div>
    </div>

    <UAlert
      v-if="!extensionReady"
      color="warning"
      variant="subtle"
      title="Webdriver não conectado"
      description="Suba o serviço (cd webdriver && pnpm dev) antes de gravar."
    />

    <UAlert
      v-if="errorMsg"
      color="error"
      variant="subtle"
      title="Erro"
      :description="errorMsg"
    />

    <div class="flex gap-3">
      <UButton
        data-testid="record-start"
        :disabled="recording"
        icon="i-lucide-circle"
        color="error"
        @click="start()"
      >
        Gravar
      </UButton>
      <UButton
        data-testid="record-stop"
        :disabled="!recording"
        icon="i-lucide-square"
        color="neutral"
        variant="subtle"
        @click="stop"
      >
        Parar
      </UButton>
    </div>

    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <span class="font-medium">Eventos recebidos</span>
          <UBadge variant="subtle">
            {{ events.length }}
          </UBadge>
        </div>
      </template>

      <p
        v-if="!events.length"
        class="text-sm text-muted"
      >
        Nenhum evento ainda. Clique em Gravar e interaja na aba anônima.
      </p>

      <ul
        v-else
        data-testid="record-events"
        class="space-y-2"
      >
        <li
          v-for="(e, i) in events"
          :key="i"
          class="text-sm font-mono flex gap-3 items-center"
          :class="{ 'cursor-pointer hover:underline': videoOffsetSeconds(e) !== null }"
          @click="seekTo(e)"
        >
          <UBadge
            variant="subtle"
            class="shrink-0"
          >
            {{ e.type || e.event.replace('recorder:', '') }}
          </UBadge>
          <span class="truncate">
            {{ describe(e) }}
            <template v-if="e.value"> = {{ e.value }}</template>
          </span>
          <span
            v-if="videoOffsetSeconds(e) !== null"
            class="text-xs text-muted shrink-0"
          >
            {{ videoOffsetSeconds(e)!.toFixed(1) }}s
          </span>
        </li>
      </ul>
    </UCard>

    <UCard v-if="videoSessionId">
      <template #header>
        <span class="font-medium">Vídeo gravado</span>
      </template>

      <video
        ref="videoEl"
        data-testid="record-video"
        :src="`${WEBDRIVER_URL}/recording/${videoSessionId}`"
        controls
        class="w-full rounded"
      />
    </UCard>
  </UContainer>
</template>
