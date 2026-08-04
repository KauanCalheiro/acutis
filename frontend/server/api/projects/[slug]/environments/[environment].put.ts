export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const environment = getRouterParam(event, 'environment')

  return acutis(`/api/v1/projects/${slug}/environments/${environment}`, {
    method: 'PUT',
    body: await readBody(event)
  })
})
