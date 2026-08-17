import { projectBaseUrlResponseSchema, type ProjectSettingsRequest } from '@acutis/contracts/project'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const slug = getRouterParam(event, 'slug')
  const response = await acutis(`/api/v1/projects/${slug}/settings`, { method: 'PUT', body: await readBody<ProjectSettingsRequest>(event) })
  return parseApiResponse(projectBaseUrlResponseSchema, response)
})
