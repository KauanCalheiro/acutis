import { aiSettingsSchema, type AiSettingsRequest } from '@acutis/contracts/settings'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  const response = await acutis('/api/v1/settings/ai', { method: 'PUT', body: await readBody<AiSettingsRequest>(event) })
  return parseApiResponse(aiSettingsSchema, response)
})
