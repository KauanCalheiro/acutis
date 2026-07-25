export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const { scenarioId } = await readBody<{ scenarioId: string }>(event)

  return acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}/scenarios/${scenarioId}/suggestions`, {
    method: 'POST'
  })
})
