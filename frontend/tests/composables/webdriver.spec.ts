import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eventsBaseUrl, type RecorderEvent } from '~/composables/webdriver'

// O plugin do cliente já conectou o módulo real ao subir o app de teste, então cada caso carrega
// uma cópia nova do composable — com o socket falso no lugar — para observar a conexão do zero.
let useWebdriver: typeof import('~/composables/webdriver')['useWebdriver']

// ponytail: WebSocket falso — o composable só enxerga o que chega por onmessage/onclose.
class FakeSocket {
  static last: FakeSocket | undefined

  readyState = 1
  sent: string[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((message: { data: string }) => void) | null = null

  constructor(readonly url: string) {
    FakeSocket.last = this
  }

  send(raw: string) {
    this.sent.push(raw)
  }

  receive(payload: Record<string, unknown>) {
    this.onmessage?.({ data: JSON.stringify(payload) })
  }
}

function socket() {
  return FakeSocket.last!
}

beforeEach(async () => {
  vi.useFakeTimers()
  ;(FakeSocket as unknown as { OPEN: number }).OPEN = 1
  vi.stubGlobal('WebSocket', FakeSocket)
  vi.resetModules()
  FakeSocket.last = undefined
  useWebdriver = (await import('~/composables/webdriver')).useWebdriver
  useWebdriver().state.value = {
    connected: false,
    extensionReady: false,
    recording: false,
    error: null,
    events: [],
    videoSessionId: null,
    recordingStartedAt: null,
    storageState: null
  }
  useWebdriver().ensureConnected()
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function event(payload: Record<string, unknown>) {
  socket().receive(payload)

  return useWebdriver().state.value
}

describe('useWebdriver', () => {
  it('conecta no websocket do gravador e se apresenta', () => {
    socket().onopen?.()

    expect(socket().url).toMatch(/^ws.+\/ws$/)
    expect(useWebdriver().state.value.connected).toBe(true)
    expect(socket().sent).toContain('{"type":"WHO"}')
  })

  it('não abre uma segunda conexão quando a tela pede de novo', () => {
    const before = socket()
    useWebdriver().ensureConnected()

    expect(socket()).toBe(before)
  })

  it('marca a extensão pronta quando ela se apresenta', () => {
    expect(event({ event: 'recorder:hello', recording: true })).toMatchObject({
      extensionReady: true,
      recording: true
    })
  })

  it('ignora o estado de gravação que a extensão não informou', () => {
    expect(event({ event: 'recorder:hello' }).recording).toBe(false)
  })

  it('guarda o instante em que a gravação começou', () => {
    expect(event({ event: 'recorder:started', recordingStartedAt: 1234 })).toMatchObject({
      recording: true,
      recordingStartedAt: 1234
    })
  })

  it('para a gravação quando a extensão reclama', () => {
    expect(event({ event: 'recorder:error', error: 'Aba fechada' })).toMatchObject({
      error: 'Aba fechada',
      recording: false
    })
  })

  it('explica o erro sem texto da extensão', () => {
    expect(event({ event: 'recorder:error' }).error).toBe('Erro na extensão.')
  })

  it('recebe o vídeo e a sessão ao parar', () => {
    const storageState = { cookies: [], origins: [] }

    expect(event({ event: 'recorder:stop', sessionId: 'abc', storageState })).toMatchObject({
      recording: false,
      videoSessionId: 'abc',
      storageState
    })
  })

  it('acumula os eventos gravados', () => {
    event({ event: 'recorder:click', label: 'Entrar' })

    expect(useWebdriver().state.value.events).toHaveLength(1)
  })

  it('descarta mensagem quebrada ou de outro assunto', () => {
    socket().onmessage?.({ data: 'não é json' })
    event({ event: 'outro:assunto' })
    event({ semEvento: true })

    expect(useWebdriver().state.value.events).toEqual([])
  })

  it('reconecta depois que a conexão cai', () => {
    const before = socket()
    socket().onclose?.()

    expect(useWebdriver().state.value).toMatchObject({ connected: false, extensionReady: false })

    vi.advanceTimersByTime(2000)
    expect(socket()).not.toBe(before)
  })

  it('limpa a gravação anterior ao começar outra', () => {
    event({ event: 'recorder:click', label: 'Entrar' })
    useWebdriver().startRecording('auth', { url: 'http://loja.test', storageState: '/tmp/state.json' })

    expect(useWebdriver().state.value).toMatchObject({ recording: true, events: [], videoSessionId: null })
    expect(JSON.parse(socket().sent.at(-1)!)).toEqual({
      type: 'START_RECORDING',
      mode: 'auth',
      url: 'http://loja.test',
      storageState: '/tmp/state.json'
    })
  })

  it('grava cenário por padrão', () => {
    useWebdriver().startRecording()

    expect(JSON.parse(socket().sent.at(-1)!)).toEqual({ type: 'START_RECORDING', mode: 'scenario' })
  })

  it('avisa o gravador ao parar', () => {
    useWebdriver().startRecording()
    useWebdriver().stopRecording()

    expect(socket().sent.at(-1)).toBe('{"type":"STOP_RECORDING"}')
    expect(useWebdriver().state.value.recording).toBe(false)
  })

  it('não tenta enviar com o socket fechado', () => {
    socket().readyState = 3
    useWebdriver().stopRecording()

    expect(socket().sent).toEqual([])
  })
})

describe('eventsBaseUrl', () => {
  const events = (...urls: (string | undefined)[]) => urls.map(url => ({ url })) as RecorderEvent[]

  it('usa a origem do primeiro evento que tem URL', () => {
    expect(eventsBaseUrl(events(undefined, 'http://loja.test/login?x=1'))).toBe('http://loja.test')
  })

  it('devolve nada quando não há URL utilizável', () => {
    expect(eventsBaseUrl(events())).toBeNull()
    expect(eventsBaseUrl(events('/login'))).toBeNull()
  })
})
