import { defineEventHandler, getQuery, getRouterParam, proxyRequest } from 'h3'

export default defineEventHandler((event) => {
  const { api } = useRuntimeConfig(event)
  const query = new URLSearchParams(getQuery<Record<string, string>>(event))

  return proxyRequest(event, `${api.acutis.url}/api/v1/projects/${getRouterParam(event, 'slug')}/run/stream?${query}`)
})
