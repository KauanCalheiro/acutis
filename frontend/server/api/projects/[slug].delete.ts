export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  await acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}`, { method: 'DELETE' })
})
