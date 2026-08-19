import { scenarioDetailSchema, updateScenarioRequestSchema } from '#shared/contracts/scenario'
import { defineEventHandler, getRouterParam } from 'h3'
import { scenarioUseCases } from '../../../../utils/composition/scenario'
import { parseApiResponse } from '../../../../utils/contract'
import { execute, validatedBody } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, updateScenarioRequestSchema)
  const response = await execute(() => scenarioUseCases().update(
    getRouterParam(event, 'slug') ?? '',
    getRouterParam(event, 'scenario') ?? '',
    body
  ))

  return parseApiResponse(scenarioDetailSchema, response)
})
