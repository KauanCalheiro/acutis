export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)

  return acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}/settings`, {
    method: 'PUT',
    body: await readBody(event)
  })
})
