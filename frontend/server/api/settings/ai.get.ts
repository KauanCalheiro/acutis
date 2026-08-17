import { aiSettingsSchema } from '@acutis/contracts/settings'

export default defineEventHandler(async (event) => {
  const { acutis } = useClients(event)
  return parseApiResponse(aiSettingsSchema, await acutis('/api/v1/settings/ai'))
})
