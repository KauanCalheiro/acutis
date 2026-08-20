import { runProjectRequestSchema, runProjectResponseSchema } from '#shared/contracts/scenario'
import { defineEventHandler, getRouterParam } from 'h3'
import { executionUseCases } from '../../../utils/composition/execution'
import { parseApiResponse } from '../../../utils/contract'
import { execute, validatedBody } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  const body = await validatedBody(event, runProjectRequestSchema)
  const response = await execute(() => executionUseCases().run.execute(
    getRouterParam(event, 'slug') ?? '',
    body.spec,
    body.grep
  ))

  return parseApiResponse(runProjectResponseSchema, response)
})
