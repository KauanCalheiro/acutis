import { pingResponseSchema, type PingModelRequest } from '@acutis/contracts/settings'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const response = await acutis('/api/v1/settings/ai/ping', { method: 'POST', body: await readBody<PingModelRequest>(event) })
  return parseApiResponse(pingResponseSchema, response)
})
