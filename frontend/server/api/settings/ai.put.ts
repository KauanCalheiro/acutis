export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)

  return acutis('/api/v1/settings/ai', {
    method: 'PUT',
    body: await readBody(event)
  })
})
