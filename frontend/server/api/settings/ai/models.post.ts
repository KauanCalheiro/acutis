export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)

  return acutis('/api/v1/settings/ai/models', {
    method: 'POST',
    body: await readBody(event)
  })
})
