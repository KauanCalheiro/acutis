import type { H3Event } from 'h3'
import type { FetchError, FetchOptions } from 'ofetch'
import { ofetch } from 'ofetch'

// O $fetch global é tipado para as rotas internas do Nitro; este cliente fala com a API externa.
function createClient(baseURL: string) {
  const fetcher = ofetch.create({ baseURL })

  return async <T = unknown>(path: string, options?: FetchOptions<'json'>): Promise<T> => {
    try {
      return await fetcher<T>(path, options)
    } catch (error) {
      const err = error as FetchError

      throw createError({
        statusCode: err.statusCode ?? 500,
        data: err.data
      })
    }
  }
}

export function useClients(event: H3Event) {
  const { api } = useRuntimeConfig(event)

  return {
    acutis: createClient(api.acutis.url)
  }
}
