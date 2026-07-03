import type { INestApplicationContext } from '@nestjs/common'
import { WsAdapter } from '@nestjs/platform-ws'
import type { MessageMappingProperties } from '@nestjs/websockets'
import { EMPTY, type Observable } from 'rxjs'

export class AcutisWsAdapter extends WsAdapter {
    constructor(app: INestApplicationContext) {
        super(app)
    }

    bindMessageHandler(
        buffer: { data: unknown },
        handlersMap: Map<string, MessageMappingProperties>,
        transform: (data: unknown) => Observable<unknown>,
    ): Observable<unknown> {
        try {
            const raw = typeof buffer.data === 'string'
                ? buffer.data
                : (buffer.data as Buffer).toString()

            const message = JSON.parse(raw) as { type?: string }

            if (!message.type) return EMPTY

            const handler = handlersMap.get(message.type)

            if (!handler) return EMPTY

            return transform(handler.callback(message))
        } catch {
            return EMPTY
        }
    }
}
