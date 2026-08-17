import { environmentSchema, type EnvironmentRequest } from '@acutis/contracts/environment'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const response = await acutis(`/api/v1/projects/${slug}/environments`, { method: 'POST', body: await readBody<EnvironmentRequest>(event) })
  return parseApiResponse(environmentSchema, response)
})
