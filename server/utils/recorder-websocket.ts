import type { RecordingEvent } from '@acutis/core/common/types/recording'
import type { StopResult } from '@acutis/core/webdriver/recorder/recorder.service'

interface RecorderPeer {
  send(data: string): unknown
}

interface RecorderMessage {
  text(): string
}

interface RecorderPort {
  isRecording(): boolean
  start(
    onEvent: (event: RecordingEvent) => void,
    onStarted: (recordingStartedAt: number) => void,
    onRequestStop: () => void,
    mode?: 'scenario' | 'auth',
    storageStatePath?: string,
    url?: string,
    replay?: RecordingEvent[],
    hooks?: {
      onReplayed?: (keptEvents: number | null) => void | Promise<void>
      onFailed?: (step: string) => void
      onCancelled?: (step: string) => void | Promise<void>
      onCancelRequested?: () => void | Promise<void>
    }
  ): Promise<void>
  stop(): Promise<StopResult>
}

interface RecorderCommand {
  type?: string
  mode?: 'scenario' | 'auth'
  storageState?: string
  url?: string
  /** Os passos já gravados que o navegador refaz antes de o usuário continuar. */
  replay?: RecordingEvent[]
}

function send(peer: RecorderPeer, payload: Record<string, unknown>) {
  peer.send(JSON.stringify(payload))
}

export function createRecorderWebSocketHooks(recorder: RecorderPort) {
  async function stop(peer: RecorderPeer) {
    const result = await recorder.stop()
    send(peer, { event: 'recorder:stop', ...result })
  }

  return {
    open(peer: RecorderPeer) {
      send(peer, { event: 'recorder:hello', recording: recorder.isRecording() })
    },

    async message(peer: RecorderPeer, message: RecorderMessage) {
      const body = JSON.parse(message.text()) as RecorderCommand

      if (body.type === 'WHO') {
        send(peer, { event: 'recorder:hello', recording: recorder.isRecording() })
        return
      }

      if (body.type === 'STOP_RECORDING') {
        await stop(peer)
        return
      }

      if (body.type !== 'START_RECORDING') return

      try {
        await recorder.start(
          event => send(peer, { event: `recorder:${event.type}`, ...event }),
          recordingStartedAt => send(peer, { event: 'recorder:started', recordingStartedAt }),
          () => { void stop(peer) },
          body.mode ?? 'scenario',
          body.storageState,
          body.url,
          body.replay,
          {
            onReplayed: keptEvents => send(peer, { event: 'recorder:replayed', kept: keptEvents }),
            onFailed: step => send(peer, { event: 'recorder:replay-failed', step }),
            onCancelled: async (step) => {
              send(peer, {
                event: 'recorder:error',
                error: `Retomada cancelada: não consegui refazer o passo — ${step}.`
              })
              await recorder.stop()
              send(peer, { event: 'recorder:stop', sessionId: null, storageState: null })
            },
            onCancelRequested: async () => {
              await recorder.stop()
              send(peer, { event: 'recorder:stop', sessionId: null, storageState: null })
            }
          }
        )
      } catch (error) {
        send(peer, {
          event: 'recorder:error',
          error: error instanceof Error ? error.message : 'Erro ao iniciar a gravação.'
        })
      }
    }
  }
}
