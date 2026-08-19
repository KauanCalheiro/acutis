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
      'http://store.test'
    )
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
