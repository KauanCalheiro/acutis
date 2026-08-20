import { fixedSpecSchema, scenarioFixBffRequestSchema } from '#shared/contracts/scenario'
import { defineEventHandler, getRouterParam } from 'h3'
import { generationUseCases } from '../../../utils/composition/generation'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, scenarioFixBffRequestSchema)
  const useCases = await generationUseCases()
  const response = await execute(() => useCases.scenarios.fix(
    getRouterParam(event, 'slug') ?? '',
    body.scenarioId
  ))

  return parseApiResponse(fixedSpecSchema, response)
})
