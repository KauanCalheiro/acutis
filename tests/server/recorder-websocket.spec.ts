import { describe, expect, it, vi } from 'vitest'
import { createRecorderWebSocketHooks } from '../../server/utils/recorder-websocket'

function peer() {
  return { send: vi.fn() }
}

function message(body: Record<string, unknown>) {
  return { text: () => JSON.stringify(body) }
}

function recorder() {
  return {
    isRecording: vi.fn(() => false),
    start: vi.fn(async () => {}),
    stop: vi.fn(async () => ({ sessionId: 'session-1', storageState: { cookies: [], origins: [] } }))
  }
}

describe('recorder WebSocket', () => {
  it('reports the current recorder state when the socket opens', () => {
    const service = recorder()
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()

    hooks.open(socket)

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ event: 'recorder:hello', recording: false }))
  })

  it('starts a headless-compatible recording with the received options', async () => {
    const service = recorder()
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()

    await hooks.message(socket, message({
      type: 'START_RECORDING',
      mode: 'scenario',
      storageState: '/tmp/session.json',
      url: 'http://store.test'
    }))

    expect(service.start).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      'scenario',
      '/tmp/session.json',
      'http://store.test',
      undefined,
      expect.objectContaining({ onReplayed: expect.any(Function) })
    )
  })

  it('hands the recorder the steps it has to replay before the user continues', async () => {
    const service = recorder()
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()
    const replay = [{ type: 'navigate', url: 'http://store.test/login' }]

    await hooks.message(socket, message({ type: 'START_RECORDING', replay }))

    expect(service.start).toHaveBeenCalledWith(
      expect.any(Function),
      expect.any(Function),
      expect.any(Function),
      'scenario',
      undefined,
      undefined,
      replay,
      expect.objectContaining({
        onReplayed: expect.any(Function),
        onFailed: expect.any(Function),
        onCancelled: expect.any(Function)
      })
    )
  })

  it('tells the screen when the replay is over, so nobody stops the recording mid-way', async () => {
    const service = recorder()
    service.start.mockImplementationOnce(async (...args: unknown[]) => {
      (args[7] as { onReplayed: () => void }).onReplayed()
    })
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()

    await hooks.message(socket, message({ type: 'START_RECORDING', replay: [] }))

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({ event: 'recorder:replayed' }))
  })

  it('names the step that would not replay, so the screen stops waiting in silence', async () => {
    const service = recorder()
    service.start.mockImplementationOnce(async (...args: unknown[]) => {
      (args[7] as { onFailed: (step: string) => void }).onFailed('Clica em "Entrar"')
    })
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()

    await hooks.message(socket, message({ type: 'START_RECORDING', replay: [] }))

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      event: 'recorder:replay-failed',
      step: 'Clica em "Entrar"'
    }))
  })

  it('ends a cancelled resume without a video session, so no review opens for it', async () => {
    const service = recorder()
    service.start.mockImplementationOnce(async (...args: unknown[]) => {
      await (args[7] as { onCancelled: (step: string) => Promise<void> }).onCancelled('Clica em "Entrar"')
    })
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()

    await hooks.message(socket, message({ type: 'START_RECORDING', replay: [] }))

    expect(service.stop).toHaveBeenCalled()
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      event: 'recorder:error',
      error: 'Retomada cancelada. Não consegui refazer o passo: Clica em "Entrar".'
    }))
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      event: 'recorder:stop',
      sessionId: null,
      storageState: null
    }))
  })

  it('discards a recording the user cancelled from the pill, so no review opens for it', async () => {
    const service = recorder()
    service.start.mockImplementationOnce(async (...args: unknown[]) => {
      await (args[7] as { onCancelRequested: () => Promise<void> }).onCancelRequested()
    })
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()

    await hooks.message(socket, message({ type: 'START_RECORDING' }))

    expect(service.stop).toHaveBeenCalled()
    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      event: 'recorder:stop',
      sessionId: null,
      storageState: null
    }))
    expect(socket.send).not.toHaveBeenCalledWith(expect.stringContaining('recorder:error'))
  })

  it('stops the recording and returns its video session and browser state', async () => {
    const service = recorder()
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()

    await hooks.message(socket, message({ type: 'STOP_RECORDING' }))

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      event: 'recorder:stop',
      sessionId: 'session-1',
      storageState: { cookies: [], origins: [] }
    }))
  })

  it('reports recorder startup errors through the socket', async () => {
    const service = recorder()
    service.start.mockRejectedValueOnce(new Error('Chromium indisponível'))
    const hooks = createRecorderWebSocketHooks(service)
    const socket = peer()

    await hooks.message(socket, message({ type: 'START_RECORDING' }))

    expect(socket.send).toHaveBeenCalledWith(JSON.stringify({
      event: 'recorder:error',
      error: 'Chromium indisponível'
    }))
  })
})

describe('recorder WebSocket: relato da falha ao iniciar', () => {
  function failingRecorder(error: unknown) {
    const service = recorder()
    service.start.mockRejectedValueOnce(error)

    return Object.assign(service, {
      diagnostics: vi.fn(() => ({ cdp: false, headless: false, chromiumInstalled: true }))
    })
  }

  it('relata a falha com a causa original no stack', async () => {
    const cause = new Error('browserType.launch: Target page, context or browser has been closed')
    const report = vi.fn().mockResolvedValue(true)
    const hooks = createRecorderWebSocketHooks(failingRecorder(new Error('Chromium indisponível', { cause })), report)

    await hooks.message(peer(), message({ type: 'START_RECORDING' }))

    const [sent] = report.mock.lastCall!
    expect(sent.message).toBe('Chromium indisponível')
    expect(sent.context).toBe('recorder:start')
    expect(sent.stack).toContain('Target page, context or browser has been closed')
  })

  it('relata como a gravação foi pedida, sem mandar a URL nem o caminho da sessão', async () => {
    const report = vi.fn().mockResolvedValue(true)
    const hooks = createRecorderWebSocketHooks(failingRecorder(new Error('falhou')), report)

    await hooks.message(peer(), message({
      type: 'START_RECORDING',
      mode: 'auth',
      storageState: '/tmp/storage-state.json',
      url: 'https://sistema-do-cliente.test',
      replay: [{ type: 'navigate' }, { type: 'click' }]
    }))

    const [sent] = report.mock.lastCall!
    expect(sent.details).toMatchObject({ mode: 'auth', storageState: true, url: true, replaySteps: 2 })
    expect(JSON.stringify(sent)).not.toContain('sistema-do-cliente')
    expect(JSON.stringify(sent)).not.toContain('/tmp/storage-state.json')
  })

  it('relata como o navegador estava configurado', async () => {
    const report = vi.fn().mockResolvedValue(true)
    const hooks = createRecorderWebSocketHooks(failingRecorder(new Error('falhou')), report)

    await hooks.message(peer(), message({ type: 'START_RECORDING' }))

    expect(report.mock.lastCall![0].details).toMatchObject({ cdp: false, headless: false, chromiumInstalled: true })
  })

  it('avisa a tela mesmo quando o relato falha', async () => {
    const report = vi.fn().mockRejectedValue(new Error('sem rede'))
    const hooks = createRecorderWebSocketHooks(failingRecorder(new Error('Chromium indisponível')), report)
    const socket = peer()

    await hooks.message(socket, message({ type: 'START_RECORDING' }))

    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('recorder:error'))
  })

  it('não relata a retomada que a pessoa cancelou', async () => {
    const service = recorder()
    service.start.mockImplementationOnce(async (...args: unknown[]) => {
      const hooks = args[7] as { onCancelled: (step: string) => Promise<void> }
      await hooks.onCancelled('clicar em Entrar')
    })
    const report = vi.fn()
    const hooks = createRecorderWebSocketHooks(service, report)

    await hooks.message(peer(), message({ type: 'START_RECORDING', replay: [] }))

    expect(report).not.toHaveBeenCalled()
  })
})
