export interface RecorderEvent {
  event: string
  type?: string
  url?: string
  /** O DOM ao redor do elemento no instante da ação, podado em 8KB pelo pill. */
  html?: string | null
  label?: string | null
  /** O texto do elemento no instante da ação. Só existe na gravação ao vivo; não é persistido. */
  innerText?: string | null
  value?: string | null
  sensitive?: boolean
  selectors?: {
    dataTestId?: string | null
    text?: string | null
    placeholder?: string | null
    cssStable?: string | null
  } | null
  sessionId?: string | null
  timestamp?: number
  recordingStartedAt?: number
  storageState?: StorageState | null
  inputType?: string | null
}

export interface StorageState {
  cookies: unknown[]
  origins: unknown[]
}

interface WebdriverState {
  connected: boolean
  extensionReady: boolean
  recording: boolean
  error: string | null
  events: RecorderEvent[]
  videoSessionId: string | null
  recordingStartedAt: number | null
  storageState: StorageState | null
}

const RECONNECT_DELAY_MS = 2000

let socket: WebSocket | null = null
let reconnectTimer: ReturnType<typeof setTimeout> | undefined
let started = false

export function useWebdriver() {
  const state = useState<WebdriverState>('webdriver', () => ({
    connected: false,
    extensionReady: false,
    recording: false,
    error: null,
    events: [],
    videoSessionId: null,
    recordingStartedAt: null,
    storageState: null
  }))

  const url = useRuntimeConfig().public.webdriver.acutis.url

  function send(type: string, payload: Record<string, unknown> = {}) {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type, ...payload }))
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
      case 'recorder:hello': {
        state.value.extensionReady = true
        const hello = data as { recording?: boolean }
        if (typeof hello.recording === 'boolean') state.value.recording = hello.recording
        break
      }
      case 'recorder:started':
        state.value.recording = true
        state.value.recordingStartedAt = data.recordingStartedAt ?? null
        break
      case 'recorder:error':
        state.value.error = (data as { error?: string }).error ?? 'Erro na extensão.'
        state.value.recording = false
        break
      case 'recorder:stop':
        state.value.recording = false
        state.value.videoSessionId = data.sessionId ?? null
        state.value.storageState = data.storageState ?? null
        break
      default:
        if (data.event.startsWith('recorder:')) state.value.events.push(data)
    }
  }

  function connect() {
    clearTimeout(reconnectTimer)
    socket = new WebSocket(`${url.replace('http', 'ws')}/ws`)
    socket.onopen = () => {
      state.value.connected = true
      send('WHO')
    }
    socket.onclose = () => {
      state.value.connected = false
      state.value.extensionReady = false
      reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
    }
    socket.onmessage = msg => onMessage(msg.data)
  }

  function ensureConnected() {
    if (started || import.meta.server) return
    started = true
    connect()
  }

  interface RecordingOptions {
    /** Caminho do storage-state.json do projeto. Abre a gravação já dentro do sistema. */
    storageState?: string
    /** URL do sistema (URL do projeto). Abre direto nela, sem o usuário digitar. */
    url?: string
  }

  function startRecording(mode: 'scenario' | 'auth' = 'scenario', options: RecordingOptions = {}) {
    state.value.error = null
    state.value.events = []
    state.value.videoSessionId = null
    state.value.storageState = null
    state.value.recording = true
    send('START_RECORDING', { mode, ...options })
  }

  function stopRecording() {
    send('STOP_RECORDING')
    state.value.recording = false
  }

  return {
    state,
    url,
    ensureConnected,
    startRecording,
    stopRecording
  }
}

/** A origem em que a gravação começou, que é a URL base que o backend precisa para escrever o teste. */
export function eventsBaseUrl(events: RecorderEvent[]): string | null {
  const first = events.find(event => event.url)
  if (!first?.url) return null

  try {
    return new URL(first.url).origin
  } catch {
    return null
  }
}
