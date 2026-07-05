import type { FetchError } from 'ofetch'

export default defineEventHandler(async (event) => {
  const { apiUrl } = useRuntimeConfig(event)

  try {
    return await $fetch('/api/v1/projects/create/template', {
      baseURL: apiUrl,
      method: 'POST',
      body: await readBody(event)
    })
  } catch (error) {
    const err = error as FetchError

    throw createError({
      statusCode: err.statusCode ?? 500,
      data: err.data
    })
  }
})
