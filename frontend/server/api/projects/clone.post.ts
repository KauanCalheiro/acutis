import { projectSchema } from '@acutis/contracts/project'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)

  const response = await acutis('/api/v1/projects/create/clone', {
    method: 'POST',
    body: await readBody(event)
  })

  return parseApiResponse(projectSchema, response)
})
