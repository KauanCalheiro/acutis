import { generatedAuthSetupSchema, type AuthRecordingRequest } from '@acutis/contracts/auth'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const response = await acutis(`/api/v1/projects/${slug}/auth/record`, { method: 'POST', body: await readBody<AuthRecordingRequest>(event) })
  return parseApiResponse(generatedAuthSetupSchema, response)
})
