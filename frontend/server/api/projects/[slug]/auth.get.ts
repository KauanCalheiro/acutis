import { authSetupSchema } from '@acutis/contracts/auth'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  return parseApiResponse(authSetupSchema, await acutis(`/api/v1/projects/${slug}/auth`))
})
