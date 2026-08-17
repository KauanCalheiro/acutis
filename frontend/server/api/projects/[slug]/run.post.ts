import { runProjectResponseSchema, type RunProjectRequest } from '@acutis/contracts/scenario'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const response = await acutis(`/api/v1/projects/${slug}/run`, { method: 'POST', body: await readBody<RunProjectRequest>(event) })
  return parseApiResponse(runProjectResponseSchema, response)
})
