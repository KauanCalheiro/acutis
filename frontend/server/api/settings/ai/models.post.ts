import { availableModelsSchema, type ListModelsRequest } from '@acutis/contracts/settings'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const response = await acutis('/api/v1/settings/ai/models', { method: 'POST', body: await readBody<ListModelsRequest>(event) })
  return parseApiResponse(availableModelsSchema, response)
})
