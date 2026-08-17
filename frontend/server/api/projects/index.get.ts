import { projectsResponseSchema } from '@acutis/contracts/project'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const response = await acutis('/api/v1/projects', {
    query: getQuery(event)
  })

  return parseApiResponse(projectsResponseSchema, response)
})
