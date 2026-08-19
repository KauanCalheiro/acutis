import { environmentRequestSchema, environmentSchema } from '#shared/contracts/environment'
import { defineEventHandler, getRouterParam } from 'h3'
import { environmentUseCases } from '../../../../utils/composition/environment'
import { parseApiResponse } from '../../../../utils/contract'
import { execute, validatedBody } from '../../../../utils/http'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  const environment = getRouterParam(event, 'environment')
  const body = await validatedBody(event, environmentRequestSchema)
  const response = await execute(() => environmentUseCases().update(slug ?? '', environment ?? '', body))

  return parseApiResponse(environmentSchema, response)
})
