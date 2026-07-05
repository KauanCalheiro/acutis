export default defineEventHandler((event) => {
  const { acutis } = useClients(event)

  return acutis('/api/v1/projects', {
    query: getQuery(event)
  })
})
