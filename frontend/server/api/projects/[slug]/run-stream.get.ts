import { defineEventHandler, getQuery, getRouterParam, sendStream, setResponseHeader } from 'h3'

export default defineEventHandler(async (event) => {
  const { api } = useRuntimeConfig(event)
  const query = new URLSearchParams(getQuery<Record<string, string>>(event))
  const slug = getRouterParam(event, 'slug')
  const response = await fetch(`${api.acutis.url}/api/v1/projects/${slug}/run/stream?${query}`)

  if (!response.ok || response.body === null) {
    throw createError({ statusCode: response.status || 502, statusMessage: 'Não foi possível iniciar a execução.' })
  }

  setResponseHeader(event, 'Content-Type', response.headers.get('content-type') ?? 'text/event-stream')
  setResponseHeader(event, 'Cache-Control', response.headers.get('cache-control') ?? 'no-cache')

  return sendStream(event, response.body)
})
