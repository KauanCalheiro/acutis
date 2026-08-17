import { scenarioDetailSchema, type UpdateScenarioRequest } from '@acutis/contracts/scenario'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const scenario = getRouterParam(event, 'scenario')
  const response = await acutis(`/api/v1/projects/${slug}/scenarios/${scenario}`, { method: 'PATCH', body: await readBody<UpdateScenarioRequest>(event) })
  return parseApiResponse(scenarioDetailSchema, response)
})
