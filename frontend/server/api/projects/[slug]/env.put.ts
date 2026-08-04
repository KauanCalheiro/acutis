export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)

  return acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}/env`, {
    method: 'PUT',
    body: await readBody(event)
  })
})
