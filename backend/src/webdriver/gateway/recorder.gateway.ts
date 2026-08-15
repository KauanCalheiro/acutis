import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
    type OnGatewayConnection,
} from '@nestjs/websockets'
import type { WebSocket } from 'ws'
import { RecorderService } from '../recorder/recorder.service.js'
import { safeSend } from './send.js'

@WebSocketGateway({ path: '/ws' })
export class RecorderGateway implements OnGatewayConnection {
    constructor(
        private readonly recorderService: RecorderService,
    ) { }

    handleConnection(ws: WebSocket): void {
        safeSend(ws, { event: 'recorder:hello', recording: this.recorderService.isRecording() })
    }

    @SubscribeMessage('WHO')
    handleWho(@ConnectedSocket() ws: WebSocket): void {
        safeSend(ws, { event: 'recorder:hello', recording: this.recorderService.isRecording() })
    }

    @SubscribeMessage('START_RECORDING')
    async handleStart(
        @MessageBody() body: { mode?: 'scenario' | 'auth', storageState?: string, url?: string },
        @ConnectedSocket() ws: WebSocket,
    ): Promise<void> {
        try {
            await this.recorderService.start(
                (event) => safeSend(ws, { event: `recorder:${event.type}`, ...event }),
                (recordingStartedAt) => safeSend(ws, { event: 'recorder:started', recordingStartedAt }),
                () => { void this.handleStop(ws) },
                body?.mode ?? 'scenario',
                body?.storageState,
                body?.url,
            )
        } catch (error) {
            safeSend(ws, {
                event: 'recorder:error',
                error: error instanceof Error ? error.message : 'Erro ao iniciar a gravação.',
            })
        }
    }

    @SubscribeMessage('STOP_RECORDING')
    async handleStop(@ConnectedSocket() ws: WebSocket): Promise<void> {
        const { sessionId, storageState } = await this.recorderService.stop()
        safeSend(ws, { event: 'recorder:stop', sessionId, storageState })
    }
}
