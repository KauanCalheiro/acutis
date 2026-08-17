import { authSetupSchema, type UpdateAuthSetupRequest } from '@acutis/contracts/auth'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const response = await acutis(`/api/v1/projects/${slug}/auth`, { method: 'PUT', body: await readBody<UpdateAuthSetupRequest>(event) })
  return parseApiResponse(authSetupSchema, response)
})
