import { aiSettingsSchema } from '#shared/contracts/settings'
import { defineEventHandler } from 'h3'
import { settingsUseCases } from '../../utils/composition/settings'
import { parseApiResponse } from '../../utils/contract'
import { execute } from '../../utils/http'

export default defineEventHandler(async () => {
  const settings = await settingsUseCases()
  return parseApiResponse(aiSettingsSchema, await execute(() => settings.show()))
})
