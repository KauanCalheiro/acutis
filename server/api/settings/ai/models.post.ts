import { availableModelsSchema, listModelsRequestSchema } from '#shared/contracts/settings'
import { defineEventHandler } from 'h3'
import { settingsUseCases } from '../../../utils/composition/settings'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, listModelsRequestSchema)
  const settings = await settingsUseCases()
  const response = await execute(() => settings.availableModels(body))

  return parseApiResponse(availableModelsSchema, response)
})
