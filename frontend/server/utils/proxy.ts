import type { H3Event } from 'h3'

/**
 * Repassa a requisição ao backend no mesmo caminho, trocando o prefixo `/api` por `/api/v1`.
 * É o corpo de toda rota de `server/api/` que não remapeia nada — só as que mudam o caminho, o
 * corpo ou o transporte (SSE) ganham arquivo próprio.
 */
export async function proxy(event: H3Event) {
  const { acutis } = useClients(event)
  const [path] = event.path.split('?')
  const method = event.method

  return acutis(`/api/v1${path!.slice('/api'.length)}`, {
    method,
    query: getQuery(event),
    ...(method === 'GET' || method === 'HEAD'
      ? {}
      : { body: await readBody(event).catch(() => undefined) })
  })
}
