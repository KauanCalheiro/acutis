// WebSocket do Acutis (Nitro experimental.websocket).
// A extensão conecta como ?source=extension e envia os eventos gravados;
// as páginas do frontend conectam como ?source=frontend e recebem o relay.

type WsPeer = { send: (data: string) => void }

const peers = new Set<WsPeer>()

export default defineWebSocketHandler({
  open(peer) {
    peers.add(peer)
    peer.send(JSON.stringify({ type: 'welcome', from: 'acutis-frontend' }))
  },
  message(peer, message) {
    const data = message.text()
    // relay: repassa a mensagem para todos os outros peers (extensão → frontend)
    for (const other of peers) {
      if (other !== peer) {
        try {
          other.send(data)
        } catch { /* peer caiu */ }
      }
    }
  },
  close(peer) {
    peers.delete(peer)
  }
})
