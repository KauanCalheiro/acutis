import { projectSchema } from '@acutis/contracts/project'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const response = await acutis(`/api/v1/projects/${getRouterParam(event, 'slug')}`, {
    method: 'PUT',
    body: await readBody(event)
  })

  return parseApiResponse(projectSchema, response)
})
