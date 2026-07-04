import {
    ConnectedSocket,
    MessageBody,
    SubscribeMessage,
    WebSocketGateway,
} from '@nestjs/websockets'
import type { WebSocket } from 'ws'
import { safeSend } from '../ws/send.js'
import { RunnerService } from './runner.service.js'

interface StartRunMessage {
    path: string
    spec?: string
    grep?: string
}

@WebSocketGateway({ path: '/runs' })
export class RunGateway {
    constructor(
        private readonly runnerService: RunnerService,
    ) { }

    @SubscribeMessage('START_RUN')
    async handleRun(
        @ConnectedSocket() ws: WebSocket,
        @MessageBody() body: StartRunMessage,
    ): Promise<void> {
        if (process.env.WEBDRIVER_TEST_MODE !== '1') {
            safeSend(ws, { event: 'run:error', message: 'runner endpoints only available with WEBDRIVER_TEST_MODE=1' })

            return
        }

        if (!body.path) {
            safeSend(ws, { event: 'run:error', message: 'path é obrigatório' })

            return
        }

        await this.runnerService.streamProject(
            body.path,
            { spec: body.spec, grep: body.grep },
            (event) => safeSend(ws, event),
        )
    }
}
