import { suiteRunsResponseSchema } from '#shared/contracts/report'
import { defineEventHandler, getRouterParam } from 'h3'
import { scenarioUseCases } from '../../../utils/composition/scenario'
import { parseApiResponse } from '../../../utils/contract'
import { execute } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const runs = await execute(() => scenarioUseCases().suiteRuns(getRouterParam(event, 'slug') ?? ''))

  return parseApiResponse(suiteRunsResponseSchema, { runs })
})
