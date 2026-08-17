import { environmentListSchema } from '@acutis/contracts/environment'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  return parseApiResponse(environmentListSchema, await acutis(`/api/v1/projects/${slug}/environments`))
})
