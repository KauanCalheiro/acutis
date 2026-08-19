import type { WebSocket } from 'ws'
import type { OutgoingMessage } from '../../common/types/ws.js'

export function safeSend(ws: WebSocket, payload: OutgoingMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload))
  }
}
