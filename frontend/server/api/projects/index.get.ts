export default defineEventHandler((event) => {
  const { apiUrl } = useRuntimeConfig(event)

  return $fetch('/api/v1/projects', {
    baseURL: apiUrl,
    query: getQuery(event)
  })
})
