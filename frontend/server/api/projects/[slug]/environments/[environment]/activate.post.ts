export default defineEventHandler((event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const environment = getRouterParam(event, 'environment')

  return acutis(`/api/v1/projects/${slug}/environments/${environment}/activate`, {
    method: 'POST'
  })
})
