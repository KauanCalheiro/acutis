import { probeRepositoryResponseSchema, type ProbeRepositoryRequest } from '@acutis/contracts/git'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const response = await acutis('/api/v1/projects/probe', { method: 'POST', body: await readBody<ProbeRepositoryRequest>(event) })
  return parseApiResponse(probeRepositoryResponseSchema, response)
})
