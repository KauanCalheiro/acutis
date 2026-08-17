import { environmentSchema, type EnvironmentRequest } from '@acutis/contracts/environment'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const environment = getRouterParam(event, 'environment')
  const response = await acutis(`/api/v1/projects/${slug}/environments/${environment}`, { method: 'PUT', body: await readBody<EnvironmentRequest>(event) })
  return parseApiResponse(environmentSchema, response)
})
