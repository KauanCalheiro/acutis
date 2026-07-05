export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)

  return acutis('/api/v1/projects/create/template', {
    method: 'POST',
    body: await readBody(event)
  })
})
