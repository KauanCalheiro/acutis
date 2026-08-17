import { fixedSpecSchema, type ScenarioFixBffRequest } from '@acutis/contracts/scenario'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const { scenarioId, step, error } = await readBody<ScenarioFixBffRequest>(event)

  const response = await acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}/scenarios/${scenarioId}/fix`, {
    method: 'POST',
    body: { step, error }
  })
  return parseApiResponse(fixedSpecSchema, response)
})
