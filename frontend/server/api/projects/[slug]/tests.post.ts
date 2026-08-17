import { writeTestResponseSchema, type WriteTestRequest } from '@acutis/contracts/generation'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const response = await acutis(`/api/v1/projects/${slug}/tests`, { method: 'POST', body: await readBody<WriteTestRequest>(event) })
  return parseApiResponse(writeTestResponseSchema, response)
})
