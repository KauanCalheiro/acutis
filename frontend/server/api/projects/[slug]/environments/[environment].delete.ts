export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const environment = getRouterParam(event, 'environment')
  await acutis(`/api/v1/projects/${slug}/environments/${environment}`, { method: 'DELETE' })
})
