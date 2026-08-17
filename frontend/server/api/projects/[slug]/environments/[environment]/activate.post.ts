import { environmentSchema } from '@acutis/contracts/environment'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const environment = getRouterParam(event, 'environment')
  const response = await acutis(`/api/v1/projects/${slug}/environments/${environment}/activate`, { method: 'POST' })
  return parseApiResponse(environmentSchema, response)
})
