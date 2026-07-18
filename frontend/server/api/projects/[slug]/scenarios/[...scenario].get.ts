export default defineEventHandler((event) => {
  const { acutis } = useClients(event)

  return acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}/scenarios/${getRouterParam(event, 'scenario')}`)
})
