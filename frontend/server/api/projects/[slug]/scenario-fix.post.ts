export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const { scenarioId, step, error } = await readBody<{ scenarioId: string, step: string, error: string }>(event)

  return acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}/scenarios/${scenarioId}/fix`, {
    method: 'POST',
    body: { step, error }
  })
})
