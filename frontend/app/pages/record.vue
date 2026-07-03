<script setup lang="ts">
interface RecorderEvent {
  event: string
  type?: string
  url?: string
  label?: string | null
  value?: string | null
  selectors?: { dataTestId?: string | null, text?: string | null, cssStable?: string | null } | null
  sessionId?: string | null
  timestamp?: number
  recordingStartedAt?: number
}

const hydrated = ref(false)
const extensionReady = ref(false)
const recording = ref(false)
const wsConnected = ref(false)
const errorMsg = ref<string | null>(null)
const events = ref<RecorderEvent[]>([])
const videoSessionId = ref<string | null>(null)
const recordingStartedAt = ref<number | null>(null)
const videoEl = ref<HTMLVideoElement | null>(null)

let socket: WebSocket | null = null

function send(type: string) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type }))
}

function start() {
  errorMsg.value = null
  events.value = []
  videoSessionId.value = null
  send('START_RECORDING')
}

function stop() {
  send('STOP_RECORDING')
  recording.value = false
}

function onMessage(raw: string) {
  let data: RecorderEvent
  try {
    data = JSON.parse(raw)
  } catch {
    return
  }
  if (!data.event) return

  switch (data.event) {
    case 'recorder:hello':
      extensionReady.value = true
      break
    case 'recorder:started':
      recording.value = true
      recordingStartedAt.value = data.recordingStartedAt ?? null
      break
    case 'recorder:error':
      errorMsg.value = (data as { error?: string }).error ?? 'Erro na extensão.'
      recording.value = false
      break
    case 'recorder:stop':
      recording.value = false
      videoSessionId.value = data.sessionId ?? null
      break
    default:
      if (data.event.startsWith('recorder:')) events.value.unshift(data)
  }
}

const WEBDRIVER_URL = useRuntimeConfig().public.webdriverUrl

function connect() {
  socket = new WebSocket(`${WEBDRIVER_URL.replace('http', 'ws')}/ws`)
  socket.onopen = () => {
    wsConnected.value = true
    send('WHO')
  }
  socket.onclose = () => {
    wsConnected.value = false
    extensionReady.value = false
  }
  socket.onmessage = msg => onMessage(msg.data)
}

function describe(e: RecorderEvent): string {
  const s = e.selectors
  return s?.dataTestId || s?.text || s?.cssStable || e.label || e.url || ''
}

function videoOffsetSeconds(e: RecorderEvent): number | null {
  if (!recordingStartedAt.value || !e.timestamp) return null
  return (e.timestamp - recordingStartedAt.value) / 1000
}

function seekTo(e: RecorderEvent): void {
  const offset = videoOffsetSeconds(e)
  if (offset === null || !videoEl.value) return
  videoEl.value.currentTime = Math.max(0, offset)
}

onMounted(() => {
  hydrated.value = true
  connect()
})
onBeforeUnmount(() => socket?.close())
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
          variant="subtle"
        >
          {{ wsConnected ? 'Webdriver conectado' : 'Webdriver offline' }}
        </UBadge>
        <UBadge
          :color="extensionReady ? 'success' : 'error'"
          variant="subtle"
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
        @click="start"
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
