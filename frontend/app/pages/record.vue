<script setup lang="ts">
interface RecorderEvent {
  event: string
  type?: string
  url?: string
  label?: string | null
  value?: string | null
  selectors?: { dataTestId?: string | null, text?: string | null, cssStable?: string | null } | null
}

const extensionReady = ref(false)
const recording = ref(false)
const wsConnected = ref(false)
const errorMsg = ref<string | null>(null)
const events = ref<RecorderEvent[]>([])

let socket: WebSocket | null = null

function send(type: string) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type }))
}

function start() {
  errorMsg.value = null
  events.value = []
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
      break
    case 'recorder:error':
      errorMsg.value = (data as { error?: string }).error ?? 'Erro na extensão.'
      recording.value = false
      break
    case 'recorder:stop':
      recording.value = false
      break
    default:
      if (data.event.startsWith('recorder:')) events.value.unshift(data)
  }
}

function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${proto}//${location.host}/_ws?source=frontend`)
  socket.onopen = () => {
    wsConnected.value = true
    send('WHO') // pergunta se a extensão está conectada
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

onMounted(connect)
onBeforeUnmount(() => socket?.close())
</script>

<template>
  <UContainer class="py-8 space-y-6">
    <div class="flex items-center justify-between">
      <h1 class="text-2xl font-bold">
        Gravação
      </h1>
      <div class="flex items-center gap-2">
        <UBadge
          :color="wsConnected ? 'success' : 'neutral'"
          variant="subtle"
        >
          {{ wsConnected ? 'Relay conectado' : 'Relay offline' }}
        </UBadge>
        <UBadge
          :color="extensionReady ? 'success' : 'error'"
          variant="subtle"
        >
          {{ extensionReady ? 'Extensão conectada' : 'Extensão não detectada' }}
        </UBadge>
      </div>
    </div>

    <UAlert
      v-if="!extensionReady"
      color="warning"
      variant="subtle"
      title="Extensão não conectada"
      description="Instale a extensão (chrome://extensions → Load unpacked → extension/dist) e habilite o acesso ao modo anônimo."
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
        :disabled="recording"
        icon="i-lucide-circle"
        color="error"
        @click="start"
      >
        Gravar
      </UButton>
      <UButton
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
        class="space-y-2"
      >
        <li
          v-for="(e, i) in events"
          :key="i"
          class="text-sm font-mono flex gap-3"
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
        </li>
      </ul>
    </UCard>
  </UContainer>
</template>
