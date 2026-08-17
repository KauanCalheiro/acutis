export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const scenario = getRouterParam(event, 'scenario')
  await acutis(`/api/v1/projects/${slug}/scenarios/${scenario}`, { method: 'DELETE' })
})
