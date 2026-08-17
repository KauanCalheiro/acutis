import { testDraftSchema, type DraftRecordingRequest } from '@acutis/contracts/generation'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const response = await acutis(`/api/v1/projects/${slug}/tests/draft`, { method: 'POST', body: await readBody<DraftRecordingRequest>(event) })
  return parseApiResponse(testDraftSchema, response)
})
