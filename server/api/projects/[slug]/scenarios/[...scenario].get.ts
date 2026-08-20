import { scenarioDetailSchema } from '#shared/contracts/scenario'
import { defineEventHandler, getRouterParam } from 'h3'
import { scenarioUseCases } from '../../../../utils/composition/scenario'
import { parseApiResponse } from '../../../../utils/contract'
import { execute } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const response = await execute(() => scenarioUseCases().findOne(
    getRouterParam(event, 'slug') ?? '',
    getRouterParam(event, 'scenario') ?? ''
  ))

  return parseApiResponse(scenarioDetailSchema, response)
})
