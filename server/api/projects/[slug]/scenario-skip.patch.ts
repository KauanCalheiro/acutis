import { scenarioDetailSchema, scenarioSkipRequestSchema } from '#shared/contracts/scenario'
import { defineEventHandler, getRouterParam } from 'h3'
import { scenarioUseCases } from '../../../utils/composition/scenario'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, scenarioSkipRequestSchema)
  const response = await execute(() => scenarioUseCases().skip(
    getRouterParam(event, 'slug') ?? '',
    body.scenarioId,
    body.skipped
  ))

  return parseApiResponse(scenarioDetailSchema, response)
})
